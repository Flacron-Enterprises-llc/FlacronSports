// Sport-specific predictions, groups, fan clubs, badges, referrals, assistant standings
// and the alert changes. Everything runs against the serialized fake store.
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { fakeDb } from "./fake-db"
import { runAlerts, listNotifications, type AlertDeps, type NotificationRecord, type UserRow } from "@/lib/alerts/notifications"
import { buildAlert, buildSummary, summaryDue, summaryHour, suppressionReason } from "@/lib/alerts/rules"
import { answerQuestion, type AssistantSources } from "@/lib/assistant/engine"
import { eraseCommunityData, exportCommunityData } from "@/lib/community/account"
import { badgesFor, earnedBadges, refreshBadges } from "@/lib/community/badges"
import { listMessages, reportMessage } from "@/lib/community/chat"
import { clubId, getClub, joinClub, joinExistingClub, leaveClub, listClubs, sportClub } from "@/lib/community/clubs"
import { closeGroup, createGroup, getGroup, joinGroup, MAX_GROUP_MEMBERS, removeGroupMember, resolveGroupMemberRef, revokeGroupInvite } from "@/lib/community/groups"
import { removeMessage, setLock } from "@/lib/community/moderation"
import { getLeaderboard, POINTS, predictionKind, predictionOpen, scorePodium, scoreWinner, settleMatch, submitPrediction } from "@/lib/community/predictions"
import { awardReferral, canonicalEmail, claimReferral, emailKeyOf, getReferralAccount, REFERRAL_CAP, REFERRAL_POINTS, reverseReferral } from "@/lib/community/referrals"
import { listMyRooms, postRoomMessage } from "@/lib/community/rooms"
import { APP_ID } from "@/lib/billing/plans"
import { processStripeEvent, type EventMutation } from "@/lib/billing/webhook-core"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/me/preferences-defaults"
import type { SportEvent } from "@/lib/sports/types"
import type { Firestore } from "firebase-admin/firestore"
import type Stripe from "stripe"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

const now = new Date("2026-11-06T12:00:00Z")
const later = (ms: number) => new Date(now.getTime() + ms)
const DAY = 86_400_000
const code = (promise: Promise<unknown>) => promise.then(() => null, (error: { code: string }) => error.code)

const event = (overrides: Partial<SportEvent> = {}): SportEvent => ({
  id: "tsdb-7", sportId: "tennis", eventType: "match", participantType: "individual",
  participants: [{ id: null, name: "Ana Ruiz", role: "competitor", badgeUrl: null }, { id: null, name: "Zoë Klein", role: "competitor", badgeUrl: null }],
  competition: { id: "99", name: "WTA Finals", country: null }, scheduledStartUTC: later(DAY).toISOString(), status: "scheduled", providerStatus: null,
  score: { kind: "none" }, venue: null, provider: { name: "x", eventId: "7" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
})
const race = (overrides: Partial<SportEvent> = {}) => event({ sportId: "motorsport", eventType: "session", participantType: "entrant", participants: [], eventName: "Harbor Grand Prix", ...overrides })
const entries = (...names: string[]) => names.map((name, index) => ({ position: index + 1, name, team: null, time: null }))
const accepted = () => fakeDb({ acceptEveryone: true })
type Db = ReturnType<typeof fakeDb>["db"]

describe("which pick an event takes", () => {
  it("matches the sport", () => {
    expect(predictionKind(event({ sportId: "football", participantType: "team" }))).toBe("score")
    expect(predictionKind(event())).toBe("winner")
    expect(predictionKind(event({ sportId: "combat-sports", eventType: "bout" }))).toBe("winner")
    expect(predictionKind(event({ sportId: "cricket", participantType: "team" }))).toBe("winner")
    expect(predictionKind(race())).toBe("podium")
  })
  it("leaves out what the feed could never settle", () => {
    expect(predictionKind(event({ sportId: "cricket", participantType: "team", competition: { id: "1", name: "Ashes Test Series", country: null } }))).toBeNull()
    expect(predictionKind(race({ eventName: "Harbor Grand Prix Qualifying" }))).toBeNull()
    expect(predictionKind(race({ eventName: "Harbor Grand Prix Practice 3" }))).toBeNull()
    expect(predictionKind(event({ participants: [] }))).toBeNull()
    expect(predictionKind(event({ participants: [event().participants[0], { id: null, name: "TBD", role: "competitor", badgeUrl: null }] }))).toBeNull()
  })
  it("locks at the start, and stays closed with no real start time", () => {
    const start = later(DAY)
    expect(predictionOpen(event(), now)).toBe(true)
    expect(predictionOpen(event(), start)).toBe(false)
    expect(predictionOpen(event({ dateOnly: true }), now)).toBe(false)
    expect(predictionOpen(event({ status: "postponed" }), now)).toBe(false)
  })
})

describe("winner and podium predictions", () => {
  const field = ["A", "B", "C", "D"]
  const pick = (db: Db, target: SportEvent, input: object, uid = "u1", at = now) => submitPrediction(db, { uid, displayName: uid, event: target, ...input }, at)

  it("only takes a named participant or a known entrant", async () => {
    const { db } = accepted()
    expect(await code(pick(db, event(), { winner: "Somebody Else" }))).toBe("invalid_pick")
    expect(await code(pick(db, race(), { podium: ["A", "B", "A"], entrants: field }))).toBe("invalid_pick")
    expect(await code(pick(db, race(), { podium: ["A", "B", "Z"], entrants: field }))).toBe("invalid_pick")
    expect(await code(pick(db, race(), { podium: ["A", "B", "C"], entrants: [] }))).toBe("not_supported")
    expect(await code(pick(db, event(), { winner: "Ana Ruiz" }, "u1", later(DAY)))).toBe("prediction_locked")
  })
  it("scores a winner, ignoring accents and case", () => {
    expect(scoreWinner("Zoe Klein", "ZOË KLEIN")).toBe(POINTS.winner)
    expect(scoreWinner("Ana Ruiz", "Zoë Klein")).toBe(0)
  })
  it("scores each podium place, and never lands on the exact score value", () => {
    expect(scorePodium(["A", "B", "C"], ["A", "B", "C"])).toBe(3 * POINTS.podiumExact)
    expect(scorePodium(["A", "C", "B"], ["A", "B", "C"])).toBe(POINTS.podiumExact + 2 * POINTS.podiumPlaced)
    expect(scorePodium(["D", "E", "F"], ["A", "B", "C"])).toBe(0)
    const values = [["A", "B", "C"], ["A", "C", "B"], ["B", "C", "A"], ["A", "D", "E"], ["D", "A", "E"], ["D", "A", "B"], ["A", "D", "C"]].map((picks) => scorePodium(picks, ["A", "B", "C"]))
    expect(values).not.toContain(POINTS.exact)
    expect(POINTS.winner).not.toBe(POINTS.exact)
  })
  it("settles a winner once, and a correction moves the total by the difference", async () => {
    const { db, docs } = accepted()
    await pick(db, event(), { winner: "Ana Ruiz" })
    const won = event({ status: "finished", score: { kind: "sets", lines: [], winner: "Ana Ruiz", retired: null } })
    await settleMatch(db, won)
    expect((await settleMatch(db, won)).settled).toBe(0)
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: POINTS.winner, exact: 0 })
    await settleMatch(db, event({ status: "finished", score: { kind: "sets", lines: [], winner: "Zoë Klein", retired: null } }))
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: 0 })
  })
  it("treats a retirement as a win for the other player", async () => {
    const { db, docs } = accepted()
    await pick(db, event(), { winner: "Zoë Klein" })
    await settleMatch(db, event({ status: "finished", score: { kind: "sets", lines: [], winner: null, retired: "Ana Ruiz" } }))
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: POINTS.winner })
  })
  it("settles a race from the classification", async () => {
    const { db, docs } = accepted()
    await pick(db, race(), { podium: ["A", "C", "B"], entrants: field })
    await settleMatch(db, race({ status: "finished", score: { kind: "classification", entries: entries("A", "B", "C", "D") } }))
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: POINTS.podiumExact + 2 * POINTS.podiumPlaced, exact: 0 })
  })
  it("voids a tied cricket match, and does not count an unconfirmed winner as one", async () => {
    const { db, docs } = accepted()
    const cricket = event({ sportId: "cricket", participantType: "team" })
    await pick(db, cricket, { winner: "Ana Ruiz" })
    await settleMatch(db, { ...cricket, status: "finished", score: { kind: "innings", home: { runs: 200, wickets: 9, overs: null }, away: { runs: 200, wickets: 7, overs: null }, winner: null, margin: null } })
    expect(docs.get("predictions/tsdb-7_u1")).toMatchObject({ voided: true, points: 0 })
  })
  it("waits for a result, then voids at the published limits", async () => {
    const { db, docs } = accepted()
    await pick(db, event(), { winner: "Ana Ruiz" })
    const past = (days: number) => new Date(Date.now() - days * DAY).toISOString()
    expect((await settleMatch(db, event({ status: "finished", scheduledStartUTC: past(1) }))).settled).toBe(0)
    expect((await settleMatch(db, event({ status: "postponed", scheduledStartUTC: past(10) }))).settled).toBe(0)
    expect((await settleMatch(db, event({ status: "finished", scheduledStartUTC: past(8) }))).settled).toBe(1)
    expect(docs.get("predictions/tsdb-7_u1")).toMatchObject({ voided: true })
    const { db: other, docs: otherDocs } = accepted()
    await pick(other, event(), { winner: "Ana Ruiz" })
    await settleMatch(other, event({ status: "postponed", scheduledStartUTC: past(31) }))
    expect(otherDocs.get("predictions/tsdb-7_u1")).toMatchObject({ voided: true })
  })
  it("publishes the same numbers it scores, in both languages", () => {
    const en = JSON.stringify(getDictionary("en").community.predictionRuleList)
    const fr = JSON.stringify(getDictionary("fr").community.predictionRuleList)
    expect(en).toContain(`Exact score ${POINTS.exact}, correct outcome ${POINTS.outcome}. Correct winner ${POINTS.winner}`)
    expect(fr).toContain(`Score exact ${POINTS.exact}, bonne issue ${POINTS.outcome}. Bon vainqueur ${POINTS.winner}`)
    expect(en).toMatch(/Ties.*Postponements.*Void events/)
    expect(getDictionary("fr").community.predictionRuleList).toHaveLength(getDictionary("en").community.predictionRuleList.length)
  })
})

describe("private groups", () => {
  const start = async (db: Db) => createGroup(db, { uid: "owner", displayName: "Owner", name: "Friends" }, now)
  const join = (db: Db, uid: string, token: string) => joinGroup(db, { uid, displayName: uid, token }, now)

  it("ranks members by league points, with ties sharing a rank", async () => {
    const { db, put } = accepted()
    const { id, inviteToken } = await start(db)
    await join(db, "a", inviteToken)
    await join(db, "b", inviteToken)
    put("prediction_points/owner", { uid: "owner", displayName: "Owner", points: 5, exact: 1 })
    put("prediction_points/a", { uid: "a", displayName: "a", points: 5, exact: 0 })
    const view = await getGroup(db, id, "owner")
    expect(view.entries.map((entry) => [entry.displayName, entry.rank, entry.points])).toEqual([["Owner", 1, 5], ["a", 1, 5], ["b", 3, 0]])
    expect(JSON.stringify(view)).not.toMatch(/inviteHash|"owner"[^,]*uid/)
  })
  it("stops an old link when the invite is rotated or revoked", async () => {
    const { db } = accepted()
    const { id, inviteToken } = await start(db)
    const { inviteToken: next } = await revokeGroupInvite(db, { groupId: id, uid: "owner", replace: true })
    expect(await code(join(db, "a", inviteToken))).toBe("invite_invalid")
    await join(db, "a", next as string)
    await revokeGroupInvite(db, { groupId: id, uid: "owner", replace: false })
    expect(await code(join(db, "b", next as string))).toBe("invite_invalid")
  })
  it("keeps a removed member out, hides the group from outsiders and enforces the cap", async () => {
    const { db, put } = accepted()
    const { id, inviteToken } = await start(db)
    await join(db, "a", inviteToken)
    expect(await code(getGroup(db, id, "stranger"))).toBe("not_found")
    const ref = await resolveGroupMemberRef(db, id, (await getGroup(db, id, "owner")).entries.find((entry) => entry.displayName === "a")?.ref as string)
    expect(await code(removeGroupMember(db, { groupId: id, actorUid: "a", targetUid: "owner" }))).toBe("forbidden")
    await removeGroupMember(db, { groupId: id, actorUid: "owner", targetUid: ref })
    expect(await code(join(db, "a", inviteToken))).toBe("removed_from_group")
    put(`prediction_groups/${id}`, { ownerUid: "owner", name: "Friends", memberCount: MAX_GROUP_MEMBERS, status: "active", inviteHash: "x", createdAtUTC: "" })
    expect(await code(join(db, "c", inviteToken))).toBe("group_full")
  })
  it("limits how many a person owns and closes cleanly", async () => {
    const { db } = accepted()
    const groups = []
    for (let index = 0; index < 5; index += 1) groups.push(await start(db))
    expect(await code(start(db))).toBe("group_limit")
    await closeGroup(db, { groupId: groups[0].id, uid: "owner" })
    expect(await code(join(db, "a", groups[0].inviteToken))).toBe("invite_invalid")
    await start(db)
  })
})

describe("fan clubs", () => {
  const football = sportClub("football", "Football")
  const join = (db: Db, uid: string) => joinClub(db, { uid, displayName: uid, club: football }, now)

  it("counts members and creates the club once, with a stable id", async () => {
    const { db } = accepted()
    const { id } = await join(db, "a")
    expect(id).toBe(clubId(football))
    expect(id).toMatch(/^[a-f0-9]{24}$/)
    await join(db, "a")
    await join(db, "b")
    expect(await getClub(db, id, "c")).toMatchObject({ members: 2, joined: false, kind: "sport" })
    await leaveClub(db, { id, uid: "b" })
    expect((await getClub(db, id, "a")).members).toBe(1)
    await joinExistingClub(db, { id, uid: "b", displayName: "b" }, now)
    expect((await getClub(db, id, "a")).members).toBe(2)
  })
  it("uses the existing chat, with slow mode, and keeps it members-only", async () => {
    const { db } = accepted()
    const { id } = await join(db, "a")
    await join(db, "b")
    const { id: message } = await postRoomMessage(db, { roomId: id, uid: "a", text: "hello" }, now)
    expect(await code(postRoomMessage(db, { roomId: id, uid: "a", text: "again" }, later(1000)))).toBe("slow_mode")
    await postRoomMessage(db, { roomId: id, uid: "a", text: "again" }, later(6000))
    expect(await code(postRoomMessage(db, { roomId: id, uid: "outsider", text: "hi" }, now))).toBe("not_found")
    expect((await listMessages(db, { scope: "room", scopeId: id, viewerUid: "b" })).messages).toHaveLength(2)
    expect(await code(reportMessage(db, { scope: "room", scopeId: id, messageId: message, reporterUid: "outsider", reason: "spam" }, now))).toBe("not_found")
    await reportMessage(db, { scope: "room", scopeId: id, messageId: message, reporterUid: "b", reason: "spam" }, now)
  })
  it("answers to the moderation tools a room does", async () => {
    const { db } = accepted()
    const { id } = await join(db, "a")
    const { id: message } = await postRoomMessage(db, { roomId: id, uid: "a", text: "hello" }, now)
    await removeMessage(db, { scope: "room", scopeId: id, messageId: message, reason: "abuse", actorUid: "mod" }, now)
    expect((await listMessages(db, { scope: "room", scopeId: id, viewerUid: "a" })).messages[0]).toMatchObject({ removed: true, text: "" })
    await setLock(db, { scope: "room", scopeId: id, locked: true, reason: "raid", actorUid: "mod" }, now)
    expect(await code(postRoomMessage(db, { roomId: id, uid: "a", text: "x" }, later(60_000)))).toBe("room_locked")
  })
  it("refuses a suspended member and stays out of the private room list", async () => {
    const { db, put } = accepted()
    put("community_sanctions/bad", { type: "suspend", untilUTC: later(DAY).toISOString(), reason: "x" })
    expect(await code(join(db, "bad"))).toBe("sanctioned")
    await join(db, "a")
    expect(await listMyRooms(db, "a")).toEqual([])
    const list = await listClubs(db, { uid: "a", locale: "en", favorites: ["Harbor City"] })
    expect(list.mine).toHaveLength(1)
    expect(list.sports.find((club) => club.sportId === "football")).toMatchObject({ members: 1, joined: true })
    expect(list.followed).toEqual(["Harbor City"])
  })
})

describe("supporter badges", () => {
  it("comes only from activity", () => {
    expect(earnedBadges({ favorites: 0, clubs: 0, predictions: 9, exact: 4 })).toEqual([])
    expect(earnedBadges({ favorites: 1, clubs: 1, predictions: 50, exact: 5 })).toEqual(["supporter", "club_member", "predictor", "veteran", "sharp"])
  })
  it("reads the real records, drops a badge when the activity ends, and shows beside names", async () => {
    const { db, put } = accepted()
    put("user_preferences/a", { favorites: ["Harbor City"] })
    const { id } = await joinClub(db, { uid: "a", displayName: "a", club: sportClub("tennis", "Tennis") }, now)
    expect(await refreshBadges(db, "a", now)).toEqual(["supporter", "club_member"])
    await leaveClub(db, { id, uid: "a" })
    expect(await refreshBadges(db, "a", now)).toEqual(["supporter"])
    expect((await badgesFor(db, ["a", "nobody"])).get("nobody")).toEqual([])
    put("prediction_points/a", { uid: "a", displayName: "a", points: 3, exact: 0 })
    expect((await getLeaderboard(db))[0].badges).toEqual(["supporter"])
  })
  it("sells nothing: no badge depends on a plan or a purchase", () => {
    const source = readFileSync("lib/community/badges.ts", "utf8")
    expect(source).not.toMatch(/plan|billing|purchase|entitlement/i)
  })
})

describe("referrals", () => {
  const setup = async () => {
    const store = accepted()
    const account = await getReferralAccount(store.db, { uid: "ref", email: "owner@example.test" }, now)
    return { ...store, code: account.code }
  }
  const paid = (put: (path: string, data: object) => void, uid: string, id = `in_${uid}`) => put(`billing_payments/${id}`, { uid, amountPaid: 1999, stripeInvoiceId: id })

  it("takes an award back on a full refund of the payment that earned it, once, for good", async () => {
    const { db, docs, put, code: link } = await setup()
    await claimReferral(db, { uid: "friend", email: "friend@example.test", code: link }, now)
    paid(put, "friend")
    await awardReferral(db, { uid: "friend", paymentId: "in_friend" }, now)
    expect(await reverseReferral(db, { paymentId: "in_other" }, now)).toEqual({ reversed: false })
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: REFERRAL_POINTS, awards: 1 })

    expect(await reverseReferral(db, { paymentId: "in_friend" }, now)).toEqual({ reversed: true })
    expect(await reverseReferral(db, { paymentId: "in_friend" }, now)).toEqual({ reversed: false })
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: 0, awards: 0 })
    expect(docs.get(`referral_claims/${emailKeyOf("friend@example.test")}`)).toMatchObject({ status: "reversed" })

    paid(put, "friend", "in_next")
    expect(await awardReferral(db, { uid: "friend", paymentId: "in_next" }, now)).toEqual({ awarded: false })
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: 0, awards: 0 })
  })
  it("takes nothing from the referrer for a claim that was capped", async () => {
    const { db, docs, put, code: link } = await setup()
    put("referral_accounts/ref", { ...(docs.get("referral_accounts/ref") as object), points: REFERRAL_CAP * REFERRAL_POINTS, awards: REFERRAL_CAP })
    await claimReferral(db, { uid: "friend", email: "friend@example.test", code: link }, now)
    paid(put, "friend")
    await awardReferral(db, { uid: "friend", paymentId: "in_friend" }, now)
    expect(await reverseReferral(db, { paymentId: "in_friend" }, now)).toEqual({ reversed: true })
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: REFERRAL_CAP * REFERRAL_POINTS, awards: REFERRAL_CAP })
  })
  it("keeps a hashed tombstone, so deleting an account does not free the email", async () => {
    const { db, docs, code: link } = await setup()
    const second = await getReferralAccount(db, { uid: "ref2", email: "second@example.test" }, now)
    await claimReferral(db, { uid: "friend", email: "friend@example.test", code: link }, now)
    await eraseCommunityData(db, "friend")
    const key = emailKeyOf("friend@example.test")
    expect(docs.has(`referral_claims/${key}`)).toBe(false)
    expect(Object.keys(docs.get(`referral_tombstones/${key}`) as object)).toEqual(["erasedAtUTC"])
    expect(await code(claimReferral(db, { uid: "reborn", email: "friend+new@example.test", code: second.code }, now))).toBe("referral_not_eligible")
  })
  it("sees through address spellings without banning a shared domain", () => {
    expect(canonicalEmail("Ab.C+promo@GoogleMail.com")).toBe("abc@gmail.com")
    expect(canonicalEmail("a.b+x@example.test")).toBe("a.b@example.test")
    expect(emailKeyOf("a.b@gmail.com")).toBe(emailKeyOf("ab+2@gmail.com"))
    expect(emailKeyOf("friend@example.test")).not.toBe(emailKeyOf("owner@example.test"))
  })
  it("refuses a self referral, by account or by alias", async () => {
    const { db, code: link } = await setup()
    expect(await code(claimReferral(db, { uid: "ref", email: "owner@example.test", code: link }, now))).toBe("referral_not_eligible")
    expect(await code(claimReferral(db, { uid: "other", email: "owner+2@example.test", code: link }, now))).toBe("referral_not_eligible")
    expect(await code(claimReferral(db, { uid: "x", email: "x@example.test", code: "nope" }, now))).toBe("invite_invalid")
    expect(await code(claimReferral(db, { uid: "x", email: "x@example.test", code: "aaaaaaaaaaaa" }, now))).toBe("invite_invalid")
  })
  it("awards nothing until a verified paid invoice, then exactly once", async () => {
    const { db, docs, put, code: link } = await setup()
    await claimReferral(db, { uid: "friend", email: "friend@example.test", code: link }, now)
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: 0 })
    expect(await awardReferral(db, { uid: "friend", paymentId: "in_missing" }, now)).toEqual({ awarded: false })
    put("billing_payments/in_other", { uid: "someone", amountPaid: 1999 })
    expect(await awardReferral(db, { uid: "friend", paymentId: "in_other" }, now)).toEqual({ awarded: false })
    put("billing_payments/in_free", { uid: "friend", amountPaid: 0 })
    expect(await awardReferral(db, { uid: "friend", paymentId: "in_free" }, now)).toEqual({ awarded: false })
    put("billing_payments/cs_addon", { uid: "friend", amountPaid: 999, kind: "addon" })
    expect(await awardReferral(db, { uid: "friend", paymentId: "cs_addon" }, now)).toEqual({ awarded: false })
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: 0, awards: 0 })

    paid(put, "friend")
    expect(await awardReferral(db, { uid: "friend", paymentId: "in_friend" }, now)).toEqual({ awarded: true })
    expect(await awardReferral(db, { uid: "friend", paymentId: "in_friend" }, now)).toEqual({ awarded: false })
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: REFERRAL_POINTS, awards: 1 })
  })
  it("refuses a person twice under another alias, and an account that already paid", async () => {
    const { db, put, code: link } = await setup()
    await claimReferral(db, { uid: "friend", email: "fan.one@gmail.com", code: link }, now)
    await claimReferral(db, { uid: "friend", email: "fan.one@gmail.com", code: link }, now)
    expect(await code(claimReferral(db, { uid: "second", email: "fanone+2@gmail.com", code: link }, now))).toBe("referral_not_eligible")
    paid(put, "old")
    expect(await code(claimReferral(db, { uid: "old", email: "old@example.test", code: link }, now))).toBe("referral_not_eligible")
  })
  it("stops at the cap and records the rest with no points", async () => {
    const { db, docs, put, code: link } = await setup()
    for (let index = 0; index <= REFERRAL_CAP; index += 1) {
      const uid = `f${index}`
      await claimReferral(db, { uid, email: `${uid}@example.test`, code: link }, now)
      paid(put, uid)
      await awardReferral(db, { uid, paymentId: `in_${uid}` }, now)
    }
    expect(docs.get("referral_accounts/ref")).toMatchObject({ points: REFERRAL_CAP * REFERRAL_POINTS, awards: REFERRAL_CAP })
    expect(docs.get(`referral_claims/${emailKeyOf(`f${REFERRAL_CAP}@example.test`)}`)).toMatchObject({ status: "capped" })
  })
  it("promises points only, in both languages", () => {
    expect(getDictionary("en").community.referralRules).toMatch(/cannot be exchanged for money, plan credit or prizes/)
    expect(getDictionary("fr").community.referralRules).toMatch(/ne peuvent être échangés contre de l'argent/)
  })
  it("hears about a paid invoice after the record is written, and again on redelivery", async () => {
    const invoice = (type: string) => ({ id: `evt_${type}`, type, created: 100, livemode: false, data: { object: { id: "in_1", amount_paid: 1999, currency: "usd", parent: { subscription_details: { subscription: "sub_1" } } } } }) as unknown as Stripe.Event
    const subscription = {
      id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false, metadata: { app_id: APP_ID, firebase_uid: "friend" },
      items: { data: [{ price: { id: "price_m" }, current_period_start: 1, current_period_end: 2 }] },
    } as unknown as Stripe.Subscription
    const claimed = new Set<string>()
    const order: string[] = []
    const store = {
      async commitEvent(event: { id: string }, mutation: EventMutation) {
        if (claimed.has(event.id)) return { duplicate: true }
        claimed.add(event.id)
        if (mutation.ledger) order.push(`ledger:${mutation.ledger.id}`)
        return { duplicate: false }
      },
    }
    const onPaidInvoice = vi.fn(async (uid: string, id: string) => order.push(`hook:${uid}:${id}`))
    const deps = { store, onPaidInvoice, retrieveSubscription: async () => subscription, retrieveCheckoutSession: async () => ({}) as Stripe.Checkout.Session, env: { STRIPE_PRICE_BASIC_MONTHLY: "price_m" } }
    await processStripeEvent(invoice("invoice.paid"), deps)
    expect(await processStripeEvent(invoice("invoice.paid"), deps)).toBe("duplicate")
    expect(order).toEqual(["ledger:in_1", "hook:friend:in_1", "hook:friend:in_1"])
    await processStripeEvent(invoice("customer.subscription.updated"), deps)
    expect(onPaidInvoice).toHaveBeenCalledTimes(2)
  })
  it("is reached from the webhook without Firestore in the billing core", () => {
    expect(readFileSync("lib/billing/webhook-core.ts", "utf8")).not.toMatch(/community\/referrals/)
    expect(readFileSync("app/api/webhooks/stripe/route.ts", "utf8")).toMatch(/onPaidInvoice: \(uid, invoiceId\) => awardReferral/)
  })
})

describe("data rights for the new records", () => {
  it("exports them and leaves nothing that names the person", async () => {
    const { db, docs, put } = accepted()
    const uid = "gone"
    await getReferralAccount(db, { uid, email: "gone@example.test" }, now)
    const other = await getReferralAccount(db, { uid: "ref", email: "ref@example.test" }, now)
    await claimReferral(db, { uid, email: "gone@example.test", code: other.code }, now)
    const mine = await getReferralAccount(db, { uid, email: "gone@example.test" }, now)
    await claimReferral(db, { uid: "friend", email: "friend@example.test", code: mine.code }, now)
    const hosted = await createGroup(db, { uid, displayName: "Gone", name: "Mine" }, now)
    const theirs = await createGroup(db, { uid: "ref", displayName: "Ref", name: "Theirs" }, now)
    await joinGroup(db, { uid, displayName: "Gone", token: theirs.inviteToken }, now)
    const club = await joinClub(db, { uid, displayName: "Gone", club: sportClub("rugby", "Rugby") }, now)
    await postRoomMessage(db, { roomId: club.id, uid, text: "hi" }, now)
    put(`community_badges/${uid}`, { uid, badges: ["supporter"] })

    const data = await exportCommunityData(db, uid)
    expect(data.fanClubs).toEqual([expect.objectContaining({ name: "Rugby" })])
    expect(data.rooms).toEqual([])
    expect(data.predictionGroups).toHaveLength(2)
    expect(data.badges).toEqual(["supporter"])
    expect(data.referrals).toMatchObject({ code: mine.code, joinedThroughInvite: [{ status: "pending" }] })

    await eraseCommunityData(db, uid)
    const left = [...docs].filter(([path, value]) => path.includes(uid) || JSON.stringify(value).includes(`"${uid}"`) || JSON.stringify(value).includes("Gone"))
    expect(left).toEqual([])
    expect(docs.get(`prediction_groups/${hosted.id}`)).toMatchObject({ status: "closed", name: "" })
    expect(docs.get(`prediction_groups/${theirs.id}`)).toMatchObject({ memberCount: 1 })
    expect((await getClub(db, club.id, "ref")).members).toBe(0)
  })
})

describe("every new route", () => {
  const routes = [
    "app/api/predictions/route.ts", "app/api/predictions/entrants/route.ts", "app/api/community/badges/route.ts", "app/api/referrals/route.ts",
    "app/api/groups/route.ts", "app/api/groups/join/route.ts", "app/api/groups/[id]/route.ts", "app/api/groups/[id]/invite/route.ts", "app/api/groups/[id]/members/[uid]/route.ts",
    "app/api/clubs/route.ts", "app/api/clubs/[id]/route.ts",
  ]
  it.each(routes)("%s needs a member and is rate limited", (path) => {
    const source = readFileSync(path, "utf8")
    expect(source).toMatch(/requireFeature\("COMMUNITY_ENABLED"\)/)
    expect(source).toMatch(/requireUser|requireVerifiedUser/)
    expect(source).toMatch(/requireSubscriber\(user\.uid\)/)
    expect(source).toMatch(/rateLimit\(/)
  })
  it("leaves the plan check off the invitation claim alone, which runs before a plan exists", () => {
    const source = readFileSync("app/api/referrals/claim/route.ts", "utf8")
    expect(source).toMatch(/requireVerifiedUser/)
    expect(source).toMatch(/rateLimit\(/)
    expect(source).toMatch(/safeParse/)
  })
})

describe("assistant standings and live events", () => {
  const nowFeed = { state: "ok" as const, source: "x", fetchedAt: now.toISOString(), limited: false }
  const game = (overrides: Partial<SportEvent> = {}) => event({
    sportId: "football", participantType: "team", status: "scheduled",
    competition: { id: "4328", name: "English Premier League", country: null },
    participants: [{ id: null, name: "Arsenal", role: "home", badgeUrl: null }, { id: null, name: "Chelsea", role: "away", badgeUrl: null }],
    ...overrides,
  })
  const row = (rank: number, team: string, points: number | null) => ({ rank, team, played: 10, won: null, drawn: null, lost: null, scoredFor: null, scoredAgainst: null, difference: null, points, form: null, zone: null })
  const table = (rows = [row(1, "Arsenal", 25), row(2, "Chelsea", null)]) => ({
    state: "ok" as const, league: "English Premier League", season: "2026-2027", rows, source: "x", fetchedAt: now.toISOString(), sourceUpdatedAt: "2026-11-05T10:00:00.000Z", limited: false,
  })
  const sources = (overrides: Partial<AssistantSources> = {}): AssistantSources => ({
    getEvents: async () => ({ ...nowFeed, events: [game()] }),
    getTeamFixtures: async () => ({ team: null, recent: [], feed: nowFeed }),
    getStandings: async () => table(),
    ...overrides,
  })
  const ask = (question: string, from = sources(), locale: "en" | "fr" = "en") => answerQuestion(question, locale, from, now)

  it("answers from the table, with source and timestamp, and keeps a missing value missing", async () => {
    const answer = await ask("Premier League standings")
    expect(answer.kind).toBe("standings")
    expect(answer.table?.rows[1]).toMatchObject({ team: "Chelsea", points: null })
    expect(answer.sources).toHaveLength(1)
    expect(answer.asOfUTC).toBe("2026-11-05T10:00:00.000Z")
    expect(answer.notes.join()).toMatch(/not a forecast/)
    expect(answer.charged).toBe(true)
    expect((await ask("classement premier league", sources(), "fr")).kind).toBe("standings")
  })
  it("finds a team's table past a cup with no table, and marks and keeps the team asked about", async () => {
    const low = Array.from({ length: 15 }, (_, index) => row(index + 1, index === 13 ? "Arsenal" : `Team ${index}`, 10))
    const lookups: string[] = []
    const answer = await ask("Arsenal league position table", sources({
      getTeamFixtures: async () => ({ team: { name: "Arsenal" }, recent: [game({ competition: { id: "1", name: "FA Cup", country: null } }), game()], feed: nowFeed }),
      getStandings: async (id) => {
        lookups.push(id)
        return id === "1" ? { ...table([]), state: "empty" } : table(low)
      },
    }))
    expect(lookups).toEqual(["1", "4328"])
    expect(answer.table?.rows.at(-1)).toMatchObject({ team: "Arsenal", rank: 14, asked: true })
    expect(answer.table?.rows).toHaveLength(11)
  })
  it("admits missing data and gives the request back on an outage", async () => {
    const none = await ask("Harbor Town standings", sources({ getEvents: async () => ({ ...nowFeed, events: [] }) }))
    expect(none).toMatchObject({ kind: "no_data", charged: true })
    expect(none.table).toBeUndefined()
    const down = await ask("Premier League standings", sources({ getStandings: async () => ({ ...table([]), state: "unavailable" }) }))
    expect(down).toMatchObject({ kind: "unavailable", charged: false })
    expect((await ask("standings")).kind).toBe("unknown")
  })
  it("declines a forecast even when it is phrased around the table", async () => {
    for (const question of ["Who will finish top of the table?", "Will Arsenal win the league?", "Arsenal chances of winning", "qui va gagner le classement", "Is Arsenal going to win?"]) {
      expect((await ask(question)).kind).toBe("declined")
    }
  })
  it("only says live when the fresh feed does", async () => {
    const live = game({ status: "live", score: { kind: "team", home: 1, away: 0 } })
    const answer = await ask("Arsenal live score", sources({ getEvents: async () => ({ ...nowFeed, events: [live] }) }))
    expect(answer).toMatchObject({ kind: "live", charged: true })
    expect(answer.items[0].score).toBe("1 - 0")
    expect((await ask("Arsenal live score")).kind).toBe("no_data")
    const stale = await ask("Arsenal live score", sources({ getEvents: async () => ({ ...nowFeed, state: "stale", events: [live] }) }))
    expect(stale.kind).toBe("no_data")
    expect(stale.items).toEqual([])
    const down = await ask("what is live right now", sources({ getEvents: async () => ({ ...nowFeed, state: "unavailable", events: [] }) }))
    expect(down.kind).toBe("unavailable")
  })
})

function alertDb(seed: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, Record<string, unknown>>(Object.entries(seed))
  const docRef = (key: string) => ({
    get: async () => ({ exists: store.has(key), data: () => store.get(key) }),
    create: async (value: Record<string, unknown>) => {
      if (store.has(key)) throw Object.assign(new Error("exists"), { code: 6 })
      store.set(key, value)
    },
    set: async (value: Record<string, unknown>) => void store.set(key, value),
    update: async (patch: Record<string, unknown>) => void store.set(key, { ...store.get(key), ...patch }),
  })
  const collection = (name: string) => {
    const docs = () => [...store.entries()].filter(([key]) => key.startsWith(`${name}/`)).map(([, value]) => ({ data: () => value }))
    const query = { where: () => query, orderBy: () => query, limit: () => query, get: async () => ({ docs: docs() }) }
    return { ...query, doc: (id: string) => docRef(`${name}/${id}`) }
  }
  return { store, db: { collection } as unknown as Firestore }
}

describe("spoiler mode and alerts", () => {
  const prefs = (overrides: Partial<Preferences> = {}, alerts: Partial<Preferences["alerts"]> = {}): Preferences => ({
    ...DEFAULT_PREFERENCES, favorites: ["Harbor City"], ...overrides,
    alerts: { ...DEFAULT_PREFERENCES.alerts, types: ["start", "final", "scoring", "interval"], ...alerts },
  })
  const liveGame = event({
    sportId: "football", participantType: "team", status: "live", score: { kind: "team", home: 1, away: 0 }, scheduledStartUTC: later(-30 * 60_000).toISOString(),
    participants: [{ id: null, name: "Harbor City", role: "home", badgeUrl: null }, { id: null, name: "Ridge United", role: "away", badgeUrl: null }],
  })
  const deps = (db: Firestore, events: SportEvent[], users: UserRow[], at = now): AlertDeps => ({
    db, events, users, now: at, planFor: async () => "plus", emailFor: async () => "a@example.test", send: vi.fn(async () => true), siteUrl: "https://example.test",
  })

  it("sends no scoring alert at all with spoiler mode on", async () => {
    expect(suppressionReason(prefs({ spoilerMode: true }), "plus", "scoring", now)).toBe("spoiler")
    expect(suppressionReason(prefs(), "plus", "scoring", now)).toBeNull()
    expect(suppressionReason(prefs({ spoilerMode: true }), "plus", "start", now)).toBeNull()

    const { db, store } = alertDb()
    const counts = await runAlerts(deps(db, [liveGame], [{ uid: "u1", prefs: prefs({ spoilerMode: true }) }]))
    expect([...store.values()].filter((row) => row.type === "scoring")).toEqual([])
    expect(counts.suppressed).toBeGreaterThan(0)
    const open = await runAlerts(deps(db, [liveGame], [{ uid: "u2", prefs: prefs() }]))
    expect(open.created).toBeGreaterThan(0)
  })
  it("hides an older scoring alert once spoiler mode is on", async () => {
    const { db } = alertDb({
      "notifications/a": { uid: "u1", eventId: "tsdb-7", type: "scoring", title: "Score update", body: "1-0", spoilerFreeBody: "changed", path: "/x", createdAt: "t" },
      "notifications/b": { uid: "u1", eventId: "tsdb-7", type: "final", title: "Done", body: "2-1", spoilerFreeBody: "finished", path: "/x", createdAt: "t" },
    })
    expect(await listNotifications(db, "u1", true)).toEqual([expect.objectContaining({ type: "final", body: "finished" })])
    expect(await listNotifications(db, "u1", false)).toHaveLength(2)
  })

  const fixture = (start: string, overrides: Partial<SportEvent> = {}) => event({
    sportId: "football", participantType: "team", scheduledStartUTC: start,
    participants: [{ id: null, name: "Harbor City", role: "home", badgeUrl: null }, { id: null, name: "Ridge United", role: "away", badgeUrl: null }],
    ...overrides,
  })
  const notices = (store: Map<string, Record<string, unknown>>) => [...store.values()].filter((row) => row.type === "correction") as unknown as NotificationRecord[]
  const original = later(6 * 3_600_000).toISOString()
  const moved = later(30 * 3_600_000).toISOString()

  it("sends one correction to every follower when an event moves, and none on first sight", async () => {
    const { db, store } = alertDb()
    const users = [{ uid: "u1", prefs: prefs() }, { uid: "u2", prefs: prefs({ locale: "fr" }) }]
    await runAlerts(deps(db, [fixture(original)], users))
    expect(notices(store)).toEqual([])
    await runAlerts(deps(db, [fixture(moved)], users))
    expect(notices(store).map((notice) => notice.uid).sort()).toEqual(["u1", "u2"])
    expect(notices(store).find((notice) => notice.uid === "u1")?.title).toContain("Time change")
    await runAlerts(deps(db, [fixture(moved)], users))
    expect(notices(store)).toHaveLength(2)
  })
  it("follows the start alert setting, and still sends the start alert at the new time", async () => {
    const { db, store } = alertDb()
    await runAlerts(deps(db, [fixture(original)], [{ uid: "off", prefs: prefs({}, { types: ["final"] }) }, { uid: "on", prefs: prefs() }]))
    await runAlerts(deps(db, [fixture(moved)], [{ uid: "off", prefs: prefs({}, { types: ["final"] }) }, { uid: "on", prefs: prefs() }]))
    expect(notices(store).map((notice) => notice.uid)).toEqual(["on"])
    await runAlerts(deps(db, [fixture(moved)], [{ uid: "on", prefs: prefs() }], new Date(Date.parse(moved) - 5 * 60_000)))
    expect([...store.values()].filter((row) => row.type === "start")).toHaveLength(1)
  })
  it("tells followers about a postponement, but not when a date-only event gains a time", async () => {
    const { db, store } = alertDb()
    const users = [{ uid: "u1", prefs: prefs() }]
    await runAlerts(deps(db, [fixture(original)], users))
    await runAlerts(deps(db, [fixture(original, { status: "postponed" })], users))
    expect(notices(store)).toHaveLength(1)
    expect(notices(store)[0].body).toContain("postponed")

    const fresh = alertDb()
    await runAlerts(deps(fresh.db, [fixture(later(DAY).toISOString(), { dateOnly: true })], users))
    await runAlerts(deps(fresh.db, [fixture(later(DAY + 3_600_000).toISOString())], users))
    expect(notices(fresh.store)).toEqual([])
  })
  it("names both times in the member's language", () => {
    const body = buildAlert(fixture(moved), "correction", prefs({ locale: "fr" }), original).body
    expect(body).toContain("Nouveau début")
    expect(body).toContain("Il était prévu")
  })

  describe("daily summary", () => {
    const eightUTC = new Date("2026-11-06T08:05:00Z")
    const seed = {
      "notifications/a": { uid: "u1", eventId: "e", type: "final", title: "Harbor City v Ridge United has finished", feedKey: "u1#t" },
      "notifications/b": { uid: "u1", eventId: "e", type: "scoring", title: "Score update: Harbor City v Ridge United", feedKey: "u1#t" },
    }

    it("is off unless chosen, and arrives once at the local hour", async () => {
      expect(summaryDue(prefs(), eightUTC)).toBe(false)
      const on = prefs({}, { dailySummary: true })
      expect(summaryDue(on, eightUTC)).toBe(true)
      expect(summaryDue(on, new Date("2026-11-06T09:05:00Z"))).toBe(false)
      expect(summaryDue({ ...on, timeZone: "Asia/Tokyo" }, eightUTC)).toBe(false)
      expect(summaryDue(prefs({}, { dailySummary: true, muted: true }), eightUTC)).toBe(false)

      const { db, store } = alertDb(seed)
      const users = [{ uid: "u1", prefs: on }]
      expect((await runAlerts(deps(db, [], users, eightUTC))).summaries).toBe(1)
      expect((await runAlerts(deps(db, [], users, new Date("2026-11-06T08:20:00Z")))).summaries).toBe(0)
      const [summary] = [...store.values()].filter((row) => row.type === "summary") as unknown as NotificationRecord[]
      expect(summary).toMatchObject({ path: "/app/notifications", emailStatus: "not_requested" })
      expect(summary.title).toContain("2")
    })
    it("moves out of quiet hours instead of being lost", () => {
      expect(summaryHour(prefs({}, { quietStart: 22, quietEnd: 7 }))).toBe(8)
      expect(summaryHour(prefs({}, { quietStart: 22, quietEnd: 10 }))).toBe(10)
    })
    it("stays silent with nothing to report, and for an account with no plan", async () => {
      const on = prefs({}, { dailySummary: true })
      expect((await runAlerts(deps(alertDb().db, [], [{ uid: "u1", prefs: on }], eightUTC))).summaries).toBe(0)
      const { db } = alertDb(seed)
      expect((await runAlerts({ ...deps(db, [], [{ uid: "u1", prefs: on }], eightUTC), planFor: async () => "none" })).summaries).toBe(0)
    })
    it("leaves score updates out for spoiler mode", async () => {
      const { db, store } = alertDb(seed)
      await runAlerts(deps(db, [], [{ uid: "u1", prefs: prefs({ spoilerMode: true }, { dailySummary: true }) }], eightUTC))
      const [summary] = [...store.values()].filter((row) => row.type === "summary") as unknown as NotificationRecord[]
      expect(summary.title).toContain("1")
      expect(summary.body).not.toContain("Score update")
    })
    it("keeps the spoiler-free text free of score updates and shortens long days", () => {
      const rows = Array.from({ length: 7 }, (_, index) => ({ type: "final", title: `T${index}` }))
      const built = buildSummary([{ type: "scoring", title: "Score update" }, ...rows], prefs())
      expect(built.body).toContain("Score update")
      expect(built.spoilerFreeBody).not.toContain("Score update")
      expect(built.body).toContain("and 3 more.")
      expect(buildSummary([{ type: "scoring", title: "Score update" }], prefs()).spoilerFreeBody).toBe(getDictionary("en").alerts.summaryHidden)
    })
  })
})
