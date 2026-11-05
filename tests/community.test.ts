// Synthetic users, events and an in-memory store for isolated tests only.
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verifyIdToken = vi.fn()
vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => ({ verifyIdToken }), getAdminDb: () => null }))

import { reviewReport } from "@/lib/admin/report-review"
import { sumMoney } from "@/lib/admin/billing-health"
import { assertRole, requireAdmin, requireFeature, requireRole, type ApiError, type AuthedUser } from "@/lib/api-auth"
import { addonOnSale, ADDONS, buildPurchase, type BillingPurchase } from "@/lib/billing/addons"
import { PLANS, type PlanId } from "@/lib/billing/plans"
import { eraseCommunityData, exportCommunityData } from "@/lib/community/account"
import { blockAuthor, listBlocked, listMessages, postMatchMessage, reportMessage, unblockAuthor } from "@/lib/community/chat"
import { assertId, cleanMessage, containsPiratedStreamLink, displayNameOf, FORMER_MEMBER, MATCH_ID, OPAQUE_REF } from "@/lib/community/content"
import { closePoll, createPoll, getMatchChatState, reactToMessage, setPinnedNotice, voteInPoll } from "@/lib/community/engagement"
import { acceptGuidelines, GATE_CODE, GUIDELINES_VERSION } from "@/lib/community/gate"
import { listOpenReports, removeMessage, sanctionUser, setLock } from "@/lib/community/moderation"
import {
  getLeaderboard, pendingMatchIds, POINTS, scorePrediction, settleMatch, submitPrediction, supportsScorePrediction,
} from "@/lib/community/predictions"
import {
  assertRoomMember, closeRoom, createRoom, getRoomAsMember, joinCap, joinRoom, postRoomMessage, removeMember, resolveMemberRef, revokeInvite,
} from "@/lib/community/rooms"
import type { SportEvent } from "@/lib/sports/types"
import { fakeDb as bareDb } from "./fake-db"

/** Everyone has passed the gate here; the gate's own tests use bareDb. */
const fakeDb = () => bareDb({ acceptEveryone: true })

const staff = (uid: string, role?: string, secondFactor?: string) =>
  ({ uid, email: null, emailVerified: true, token: { role, firebase: { sign_in_second_factor: secondFactor } } }) as unknown as AuthedUser
const moderator = staff("staff-1", "moderator", "totp")
const noSecondFactor = staff("staff-2", "moderator")
const member = staff("member-1")

const now = new Date("2026-11-05T12:00:00Z")
const later = (ms: number) => new Date(now.getTime() + ms)
const DAY = 86_400_000

const match = (overrides: Partial<SportEvent> = {}) => ({
  id: "tsdb-7", sportId: "football", eventType: "match", participantType: "team",
  participants: [{ id: "1", name: "A", role: "home", badgeUrl: null }, { id: "2", name: "B", role: "away", badgeUrl: null }],
  competition: { id: "9", name: "L", country: null },
  scheduledStartUTC: later(DAY).toISOString(), status: "scheduled", providerStatus: "NS", score: { kind: "none" }, venue: null,
  provider: { name: "TheSportsDB", eventId: "7" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
}) as SportEvent

const code = async (promise: Promise<unknown>) => {
  try {
    await promise
    return "ok"
  } catch (error) {
    return (error as ApiError).code
  }
}

afterEach(() => vi.unstubAllEnvs())

describe("community flag", () => {
  it("is off unless explicitly enabled", () => {
    expect(() => requireFeature("COMMUNITY_ENABLED")).toThrow()
    vi.stubEnv("COMMUNITY_ENABLED", "true")
    expect(() => requireFeature("COMMUNITY_ENABLED")).not.toThrow()
  })
})

describe("message content", () => {
  it("caps messages at 500 characters", () => {
    expect(cleanMessage("x".repeat(500))).toHaveLength(500)
    expect(() => cleanMessage("x".repeat(501))).toThrow()
    expect(() => cleanMessage("   ")).toThrow()
  })
  it("counts characters, not UTF-16 units", () => {
    expect(() => cleanMessage("😀".repeat(500))).not.toThrow()
  })
  it.each([
    "free stream at https://streameast.io/nba",
    "go to sportsurge dot net",
    "hesgoal [dot] com",
    "s p o r t s u r g e . n e t",
    "stream​east.live",
    "acestream://abcdef",
    "http://cdn.example.net/live/index.m3u8",
    "watch free at myfootballstream.xyz",
    "full match on livefootballtv.club",
  ])("rejects a pirated stream link: %s", (text) => {
    expect(containsPiratedStreamLink(text)).toBe(true)
  })
  it.each([
    "What a strikeout!",
    "The official stream was great tonight",
    "Highlights are on https://www.bbc.co.uk/sport",
    "un point important, live ce soir",
    "the push for a goal was late",
    "Check livescore.com for the live table",
  ])("allows ordinary chat: %s", (text) => {
    expect(containsPiratedStreamLink(text)).toBe(false)
  })
  it("never exposes an email as a display name", () => {
    expect(displayNameOf({ name: "a@test.invalid" })).toBe("Fan")
    expect(displayNameOf({})).toBe("Fan")
    expect(displayNameOf({ name: "  Sam " })).toBe("Sam")
  })
  it("rejects ids that could change a document path", () => {
    expect(() => assertId("tsdb-1/../../billing", MATCH_ID)).toThrow()
    expect(assertId("tsdb-1", MATCH_ID)).toBe("tsdb-1")
  })
})

describe("match chat", () => {
  const post = (db: ReturnType<typeof fakeDb>["db"], at: Date, uid = "u1", text = "hello") =>
    postMatchMessage(db, { matchId: "tsdb-7", uid, displayName: "Sam", text }, at)

  it("applies slow mode per user on the server", async () => {
    const { db } = fakeDb()
    await post(db, now)
    expect(await code(post(db, later(1000)))).toBe("slow_mode")
    expect(await code(post(db, later(1000), "u2"))).toBe("ok")
    expect(await code(post(db, later(6000)))).toBe("ok")
  })

  it("refuses posts in a locked room and from muted or suspended users", async () => {
    const { db } = fakeDb()
    await setLock(db, { scope: "match", scopeId: "tsdb-7", locked: true, reason: "raid", actorUid: "mod" }, now)
    expect(await code(post(db, now))).toBe("room_locked")

    const open = fakeDb()
    await sanctionUser(open.db, { uid: "u1", type: "mute", hours: 1, reason: "spam", actorUid: "mod" }, now)
    expect(await code(post(open.db, later(1000)))).toBe("sanctioned")
    expect(await code(post(open.db, later(3_600_001)))).toBe("ok")
  })

  it("paginates newest first without skipping messages sent in the same millisecond", async () => {
    const { db } = fakeDb()
    for (let index = 0; index < 35; index += 1) await post(db, later(index), `u${index}`, `m${index}`)
    const first = await listMessages(db, { scope: "match", scopeId: "tsdb-7", viewerUid: null })
    expect(first.messages).toHaveLength(30)
    expect(first.messages[0].text).toBe("m34")
    const second = await listMessages(db, { scope: "match", scopeId: "tsdb-7", viewerUid: null, cursor: first.nextCursor })
    expect(second.messages).toHaveLength(5)
    expect(second.nextCursor).toBeNull()
  })

  it("never returns author ids, and hides removed text and blocked authors", async () => {
    const { db } = fakeDb()
    const { id } = await post(db, now, "author", "rude")
    const { id: other } = await post(db, now, "other", "fine")
    const list = async (viewerUid: string) => (await listMessages(db, { scope: "match", scopeId: "tsdb-7", viewerUid })).messages
    expect(JSON.stringify(await list("viewer"))).not.toContain("author")

    await blockAuthor(db, { scope: "match", scopeId: "tsdb-7", messageId: id, uid: "viewer" })
    expect((await list("viewer")).map((message) => message.id)).toEqual([other])

    await removeMessage(db, { scope: "match", scopeId: "tsdb-7", messageId: id, reason: "abuse", actorUid: "mod" }, now)
    const seen = (await list("someone")).find((message) => message.id === id)
    expect(seen).toMatchObject({ removed: true, text: "" })
  })

  it("takes the reported author from the message and keeps one open report per reporter", async () => {
    const { db } = fakeDb()
    const { id } = await post(db, now, "author", "rude")
    const input = { scope: "match" as const, scopeId: "tsdb-7", messageId: id, reporterUid: "r1", reason: "abuse" }
    await reportMessage(db, input, now)
    await reportMessage(db, input, now)
    const reports = await listOpenReports(db)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ targetUid: "author", messageText: "rude" })
  })
})

describe("private rooms", () => {
  const pass = (overrides: Partial<BillingPurchase> = {}): BillingPurchase => ({
    ...buildPurchase({ purchaseId: "rp", verifiedPaymentId: "pi", stripeChargeId: null, addon: ADDONS.room_pass, uid: "host", paidAtSeconds: now.getTime() / 1000, livemode: false }),
    ...overrides,
  })
  const base = { uid: "host", displayName: "Host", matchId: "tsdb-7", name: "Room", kickoffUTC: later(DAY).toISOString() }
  const create = (db: ReturnType<typeof fakeDb>["db"], plan: PlanId, extra: object = {}) => createRoom(db, { ...base, plan, ...extra }, now)
  const join = (db: ReturnType<typeof fakeDb>["db"], uid: string, token: string, plan: PlanId = "plus", at = now) =>
    joinRoom(db, { uid, displayName: uid, token, hostPlan: async () => plan }, at)

  it("matches the plan limits", () => {
    expect(PLANS.plus.privateRooms).toEqual({ active: 3, participantsPerRoom: 20 })
    expect(PLANS.premium.privateRooms).toEqual({ active: 10, participantsPerRoom: 50 })
    expect(PLANS.free.privateRooms).toBeNull()
  })

  it("lets Free users join but not create", async () => {
    const { db } = fakeDb()
    expect(await code(create(db, "free"))).toBe("plan_required")
    const { inviteToken } = await create(db, "plus")
    expect(await code(join(db, "free-user", inviteToken))).toBe("ok")
  })

  it.each([["plus", 3], ["premium", 10]] as const)("stops %s at %i active rooms", async (plan, limit) => {
    const { db } = fakeDb()
    for (let index = 0; index < limit; index += 1) await create(db, plan)
    expect(await code(create(db, plan))).toBe("room_limit")
  })

  it("enforces the room limit under concurrent creation", async () => {
    const { db } = fakeDb()
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => create(db, "plus")))
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3)
  })

  it("frees a slot when a room closes or expires", async () => {
    const { db } = fakeDb()
    const first = await create(db, "plus")
    await create(db, "plus")
    await create(db, "plus")
    await closeRoom(db, { roomId: first.id, uid: "host" })
    expect(await code(create(db, "plus"))).toBe("ok")
    expect(await code(createRoom(db, { ...base, plan: "plus" }, later(3 * DAY)))).toBe("ok")
  })

  it("adds one 50-person room with a pass, once, beyond the base limit", async () => {
    const { db, docs, put } = fakeDb()
    put("billing_purchases/rp", pass())
    const room = await create(db, "free")
    expect(room.room).toMatchObject({ passPurchaseId: "rp", participantCap: 50, expiresAtUTC: pass().expiresAtUTC })
    expect(docs.get("billing_purchases/rp")).toMatchObject({ consumed: 1, roomId: room.id })
    expect(await code(create(db, "free"))).toBe("plan_required")
  })

  it("uses the base allowance before spending a pass", async () => {
    const { db, docs, put } = fakeDb()
    put("billing_purchases/rp", pass())
    await create(db, "plus")
    expect(docs.get("billing_purchases/rp")?.consumed).toBe(0)
  })

  it("cannot exceed the plan cap, even when asked to", async () => {
    const { db } = fakeDb()
    expect((await create(db, "plus", { participantLimit: 500 })).room.participantCap).toBe(20)
    expect((await create(db, "plus", { participantLimit: 4 })).room.participantCap).toBe(4)
  })

  it("enforces capacity under concurrent joins and counts the host", async () => {
    const { db, docs } = fakeDb()
    const { id, inviteToken } = await create(db, "plus", { participantLimit: 4 })
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => join(db, `u${index}`, inviteToken)))
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3)
    expect(docs.get(`rooms/${id}`)?.memberCount).toBe(4)
    expect(await code(join(db, "late", inviteToken))).toBe("room_full")
  })

  it("does not count a repeat join against capacity", async () => {
    const { db, docs } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    await join(db, "u1", inviteToken)
    await join(db, "u1", inviteToken)
    expect(docs.get(`rooms/${id}`)?.memberCount).toBe(2)
  })

  it("applies the host's current plan when they downgrade", () => {
    const room = { participantCap: 50, passPurchaseId: null }
    expect(joinCap(room, "premium")).toBe(50)
    expect(joinCap(room, "plus")).toBe(20)
    expect(joinCap(room, "free")).toBe(0)
    expect(joinCap({ participantCap: 50, passPurchaseId: "p" }, "free")).toBe(50)
  })

  it("gives nonmembers the same 404 as a missing room, including former members", async () => {
    const { db } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    expect(await code(getRoomAsMember(db, id, "stranger"))).toBe("not_found")
    expect(await code(getRoomAsMember(db, "a".repeat(24), "stranger"))).toBe("not_found")
    expect(await code(assertRoomMember(db, id, "stranger"))).toBe("not_found")
    expect(await code(postRoomMessage(db, { roomId: id, uid: "stranger", text: "hi" }, now))).toBe("not_found")
    expect(await code(reportMessage(db, { scope: "room", scopeId: id, messageId: "0000000000001-aaaaaaaa", reporterUid: "stranger", reason: "abuse" }, now))).toBe("not_found")

    await join(db, "u1", inviteToken)
    await removeMember(db, { roomId: id, actorUid: "host", targetUid: "u1" })
    expect(await code(getRoomAsMember(db, id, "u1"))).toBe("not_found")
  })

  it("keeps a removed participant out, even with a new invitation", async () => {
    const { db, docs } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    await join(db, "u1", inviteToken)
    await removeMember(db, { roomId: id, actorUid: "host", targetUid: "u1" })
    expect(docs.get(`rooms/${id}`)?.memberCount).toBe(1)
    const fresh = await revokeInvite(db, { roomId: id, uid: "host", replace: true })
    expect(await code(join(db, "u1", fresh.inviteToken as string))).toBe("removed_from_room")
  })

  it("lets only the host remove people or revoke the invitation", async () => {
    const { db } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    await join(db, "u1", inviteToken)
    await join(db, "u2", inviteToken)
    expect(await code(removeMember(db, { roomId: id, actorUid: "u1", targetUid: "u2" }))).toBe("forbidden")
    expect(await code(revokeInvite(db, { roomId: id, uid: "u1", replace: false }))).toBe("forbidden")
    expect(await code(removeMember(db, { roomId: id, actorUid: "host", targetUid: "host" }))).toBe("invalid_request")
  })

  it("stops a revoked invitation and stores only its hash", async () => {
    const { db, docs } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    expect(JSON.stringify([...docs.entries()])).not.toContain(inviteToken)
    await revokeInvite(db, { roomId: id, uid: "host", replace: false })
    expect(await code(join(db, "u1", inviteToken))).toBe("invite_invalid")
    expect(await code(join(db, "u1", "unknown-token-value-000000"))).toBe("invite_invalid")
  })

  it("closes a pass room to joins and messages at expiry or refund", async () => {
    const { db, put } = fakeDb()
    put("billing_purchases/rp", pass())
    const { id, inviteToken } = await create(db, "free")
    expect(await code(postRoomMessage(db, { roomId: id, uid: "host", text: "hi" }, now))).toBe("ok")
    expect(await code(join(db, "u1", inviteToken, "free", later(8 * DAY)))).toBe("room_expired")
    expect(await code(postRoomMessage(db, { roomId: id, uid: "host", text: "hi" }, later(8 * DAY)))).toBe("room_expired")

    put("billing_purchases/rp", pass({ status: "flagged", consumed: 1 }))
    expect(await code(join(db, "u1", inviteToken, "free"))).toBe("room_expired")
  })

  it("blocks joins and messages when a moderator locks the room", async () => {
    const { db } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    await setLock(db, { scope: "room", scopeId: id, locked: true, reason: "abuse", actorUid: "mod" }, now)
    expect(await code(join(db, "u1", inviteToken))).toBe("room_locked")
    expect(await code(postRoomMessage(db, { roomId: id, uid: "host", text: "hi" }, now))).toBe("room_locked")
  })

  it("does not expose the invite hash or the host's uid to members", async () => {
    const { db } = fakeDb()
    const { id, inviteToken } = await create(db, "plus")
    await join(db, "u1", inviteToken)
    const view = await getRoomAsMember(db, id, "u1")
    expect(JSON.stringify(view)).not.toMatch(/inviteHash|"host"/)
    expect(view.members).toEqual([])
    expect((await getRoomAsMember(db, id, "host")).members).toHaveLength(2)
  })
})

describe("predictions", () => {
  const submit = (db: ReturnType<typeof fakeDb>["db"], event: SportEvent, uid = "u1", score = { home: 2, away: 1 }, at = now) =>
    submitPrediction(db, { uid, displayName: uid, event, ...score }, at)
  const finished = (home: number, away: number) => match({ status: "finished", score: { kind: "team", home, away } })

  it("accepts a score before kickoff", async () => {
    const { db } = fakeDb()
    expect(await submit(db, match())).toMatchObject({ home: 2, away: 1, points: 0, lockedAtUTC: match().scheduledStartUTC })
  })

  it("refuses after kickoff by server time", async () => {
    const { db } = fakeDb()
    const event = match({ scheduledStartUTC: now.toISOString() })
    expect(await code(submit(db, event))).toBe("prediction_locked")
    expect(await code(submit(db, event, "u1", { home: 1, away: 1 }, later(-1)))).toBe("ok")
  })

  it.each([
    ["live", { status: "live" }],
    ["postponed", { status: "postponed" }],
    ["no kickoff time", { scheduledStartUTC: null }],
  ] as [string, Partial<SportEvent>][])("refuses a match that is %s", async (_name, overrides) => {
    const { db } = fakeDb()
    expect(await code(submit(db, match(overrides)))).toBe("prediction_locked")
  })

  it("refuses a second prediction, even concurrently", async () => {
    const { db } = fakeDb()
    const results = await Promise.allSettled([submit(db, match()), submit(db, match()), submit(db, match())])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(await code(submit(db, match()))).toBe("duplicate_prediction")
  })

  it("is for team sports only and validates the score", async () => {
    const { db } = fakeDb()
    expect(supportsScorePrediction(match({ sportId: "tennis" }))).toBe(false)
    expect(supportsScorePrediction(match({ participantType: "individual" }))).toBe(false)
    expect(await code(submit(db, match({ sportId: "motorsport" })))).toBe("not_supported")
    expect(await code(submit(db, match(), "u1", { home: -1, away: 1 }))).toBe("invalid_score")
    expect(await code(submit(db, match(), "u1", { home: 1.5, away: 1 }))).toBe("invalid_score")
  })

  it("scores exact, outcome and miss", () => {
    const result = { home: 2, away: 1 }
    expect(scorePrediction({ home: 2, away: 1 }, result)).toBe(POINTS.exact)
    expect(scorePrediction({ home: 3, away: 0 }, result)).toBe(POINTS.outcome)
    expect(scorePrediction({ home: 1, away: 1 }, { home: 0, away: 0 })).toBe(POINTS.outcome)
    expect(scorePrediction({ home: 0, away: 1 }, result)).toBe(0)
  })

  it("awards points once however often settlement runs", async () => {
    const { db, docs } = fakeDb()
    await submit(db, match())
    expect((await settleMatch(db, finished(2, 1))).settled).toBe(1)
    expect((await settleMatch(db, finished(2, 1))).settled).toBe(0)
    await Promise.all([settleMatch(db, finished(2, 1)), settleMatch(db, finished(2, 1))])
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: 5, exact: 1 })
  })

  it("adjusts by the difference when a result is corrected", async () => {
    const { db, docs } = fakeDb()
    await submit(db, match())
    await settleMatch(db, finished(2, 1))
    await settleMatch(db, finished(3, 1))
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: 2, exact: 0 })
  })

  it("waits for a confirmed result", async () => {
    const { db } = fakeDb()
    await submit(db, match())
    for (const event of [match({ status: "live", score: { kind: "team", home: 2, away: 1 } }), match({ status: "finished" }), match({ status: "postponed" })]) {
      expect((await settleMatch(db, event)).settled).toBe(0)
    }
  })

  it("voids a canceled match and takes back any earlier points", async () => {
    const { db, docs } = fakeDb()
    await submit(db, match())
    await settleMatch(db, finished(2, 1))
    await settleMatch(db, match({ status: "canceled" }))
    expect(docs.get("prediction_points/u1")).toMatchObject({ points: 0, exact: 0 })
    expect(docs.get("predictions/tsdb-7_u1")).toMatchObject({ voided: true, points: 0 })
  })

  it("ranks the leaderboard with shared ranks and no uids", async () => {
    const { db, put } = fakeDb()
    put("prediction_points/a", { uid: "a", displayName: "A", points: 5, exact: 1 })
    put("prediction_points/b", { uid: "b", displayName: "B", points: 5, exact: 0 })
    put("prediction_points/c", { uid: "c", displayName: "C", points: 2, exact: 0 })
    const board = await getLeaderboard(db)
    expect(board.map((entry) => entry.rank)).toEqual([1, 1, 3])
    expect(JSON.stringify(board)).not.toContain('"uid"')
  })

  it("is empty, not padded, before any points exist", async () => {
    expect(await getLeaderboard(fakeDb().db)).toEqual([])
  })
})

describe("age and rules gate", () => {
  const scoped = { scope: "match" as const, scopeId: "tsdb-7" }
  const seed = async () => {
    const fake = bareDb()
    await acceptGuidelines(fake.db, "host", now)
    await acceptGuidelines(fake.db, "author", now)
    const { id: roomId, inviteToken } = await createRoom(fake.db, { uid: "host", displayName: "Host", plan: "plus", matchId: "tsdb-7", name: "Room", kickoffUTC: null }, now)
    const { id: messageId } = await postMatchMessage(fake.db, { matchId: "tsdb-7", uid: "author", displayName: "Author", text: "hi" }, now)
    await createPoll(fake.db, moderator, { matchId: "tsdb-7", question: "Who wins?", options: ["A", "B"] }, now)
    fake.put(`room_members/${roomId}_u1`, { roomId, uid: "u1", displayName: "U", role: "member", status: "active", joinedAtUTC: now.toISOString() })
    fake.put(`rooms/${"b".repeat(24)}`, { hostUid: "u1", matchId: "tsdb-7", inviteHash: null, status: "active" })
    fake.put(`room_members/${"b".repeat(24)}_u1`, { roomId: "b".repeat(24), uid: "u1", displayName: "U", role: "host", status: "active", joinedAtUTC: now.toISOString() })
    fake.put("room_members/x", { roomId, uid: "other", displayName: "O", role: "member", status: "active", joinedAtUTC: now.toISOString() })
    return { ...fake, roomId, inviteToken, messageId }
  }
  type Seed = Awaited<ReturnType<typeof seed>>

  it.each<[string, (s: Seed) => Promise<unknown>]>([
    ["postMatchMessage", ({ db }) => postMatchMessage(db, { matchId: "tsdb-7", uid: "u1", displayName: "U", text: "hi" }, now)],
    ["postRoomMessage", ({ db, roomId }) => postRoomMessage(db, { roomId, uid: "u1", text: "hi" }, now)],
    ["createRoom", ({ db }) => createRoom(db, { uid: "u1", displayName: "U", plan: "plus", matchId: "tsdb-7", name: "R", kickoffUTC: null }, now)],
    ["joinRoom", ({ db, inviteToken }) => joinRoom(db, { uid: "u2", displayName: "U", token: inviteToken, hostPlan: async () => "plus" }, now)],
    ["revokeInvite", ({ db }) => revokeInvite(db, { roomId: "b".repeat(24), uid: "u1", replace: false })],
    ["removeMember", ({ db, roomId }) => removeMember(db, { roomId, actorUid: "u1", targetUid: "u1" })],
    ["closeRoom", ({ db }) => closeRoom(db, { roomId: "b".repeat(24), uid: "u1" })],
    ["submitPrediction", ({ db }) => submitPrediction(db, { uid: "u1", displayName: "U", event: match(), home: 1, away: 0 }, now)],
    ["reportMessage", ({ db, messageId }) => reportMessage(db, { ...scoped, messageId, reporterUid: "u1", reason: "abuse" }, now)],
    ["blockAuthor", ({ db, messageId }) => blockAuthor(db, { ...scoped, messageId, uid: "u1" })],
    ["unblockAuthor", ({ db }) => unblockAuthor(db, { uid: "u1", ref: "c".repeat(32) })],
    ["reactToMessage", ({ db, messageId }) => reactToMessage(db, { ...scoped, messageId, uid: "u1", reaction: "like" }, now)],
    ["voteInPoll", ({ db }) => voteInPoll(db, { matchId: "tsdb-7", uid: "u1", option: 0 }, now)],
  ])("refuses %s until the guidelines are accepted", async (_name, run) => {
    const seeded = await seed()
    expect(await code(run(seeded))).toBe(GATE_CODE)
    await acceptGuidelines(seeded.db, "u1", now)
    await acceptGuidelines(seeded.db, "u2", now)
    expect(await code(run(seeded))).not.toBe(GATE_CODE)
  })

  it("stores the acceptance on the server with its time, once", async () => {
    const { db, docs } = bareDb()
    await acceptGuidelines(db, "u1", now)
    await acceptGuidelines(db, "u1", later(DAY))
    expect(docs.get("community_acceptance/u1")).toEqual({ uid: "u1", ageConfirmed: true, guidelinesVersion: GUIDELINES_VERSION, acceptedAtUTC: now.toISOString() })
  })

  it("keeps the acceptance route strict about both confirmations", () => {
    const route = readFileSync("app/api/community/accept/route.ts", "utf8")
    expect(route).toMatch(/ageConfirmed: z\.literal\(true\), guidelinesAccepted: z\.literal\(true\)/)
    expect(route).toMatch(/requireVerifiedUser/)
    expect(route).toMatch(/rateLimit/)
  })
})

describe("reactions", () => {
  const seed = async () => {
    const fake = fakeDb()
    const { id } = await postMatchMessage(fake.db, { matchId: "tsdb-7", uid: "author", displayName: "A", text: "hi" }, now)
    const react = (uid: string, reaction: unknown) => reactToMessage(fake.db, { scope: "match", scopeId: "tsdb-7", messageId: id, uid, reaction }, now)
    const seen = async (uid: string | null) => (await listMessages(fake.db, { scope: "match", scopeId: "tsdb-7", viewerUid: uid })).messages[0]
    return { ...fake, id, react, seen }
  }

  it("keeps one per user per message and counts for everyone", async () => {
    const { react, seen } = await seed()
    await react("u1", "like")
    await react("u2", "like")
    expect(await seen("u1")).toMatchObject({ reactions: { like: 2 }, myReaction: "like" })
    await react("u1", "fire")
    expect(await seen("u1")).toMatchObject({ reactions: { like: 1, fire: 1 }, myReaction: "fire" })
    expect(await seen(null)).toMatchObject({ reactions: { like: 1, fire: 1 }, myReaction: null })
  })

  it("takes a reaction back when chosen again, including under concurrency", async () => {
    const { react, seen, docs } = await seed()
    await Promise.all([react("u1", "like"), react("u1", "like"), react("u1", "like")])
    expect((await seen("u1")).reactions).toEqual({ like: 1 })
    await react("u1", "like")
    expect((await seen("u1")).reactions).toEqual({})
    expect([...docs.keys()].filter((path) => path.startsWith("message_reactions/"))).toEqual([])
  })

  it("accepts only the fixed list and never reveals who reacted", async () => {
    const { react, seen } = await seed()
    expect(await code(react("u1", "angry"))).toBe("invalid_reaction")
    await react("u1", "love")
    expect(JSON.stringify(await seen("u2"))).not.toContain("u1")
  })

  it("refuses removed messages, locked chats and suspended users, but not muted ones", async () => {
    const { db, id, react } = await seed()
    await sanctionUser(db, { uid: "s", type: "suspend", hours: 1, reason: "abuse", actorUid: "mod" }, now)
    await sanctionUser(db, { uid: "m", type: "mute", hours: 1, reason: "spam", actorUid: "mod" }, now)
    expect(await code(react("s", "like"))).toBe("sanctioned")
    expect(await code(react("m", "like"))).toBe("ok")
    await setLock(db, { scope: "match", scopeId: "tsdb-7", locked: true, reason: "raid", actorUid: "mod" }, now)
    expect(await code(react("u1", "like"))).toBe("room_locked")
    await setLock(db, { scope: "match", scopeId: "tsdb-7", locked: false, reason: "calm", actorUid: "mod" }, now)
    await removeMessage(db, { scope: "match", scopeId: "tsdb-7", messageId: id, reason: "abuse", actorUid: "mod" }, now)
    expect(await code(react("u1", "like"))).toBe("not_found")
  })

  it("keeps room reactions to room members", async () => {
    const { db } = fakeDb()
    const { id: roomId } = await createRoom(db, { uid: "host", displayName: "H", plan: "plus", matchId: "tsdb-7", name: "R", kickoffUTC: null }, now)
    const { id: messageId } = await postRoomMessage(db, { roomId, uid: "host", text: "hi" }, now)
    const react = (uid: string) => reactToMessage(db, { scope: "room", scopeId: roomId, messageId, uid, reaction: "like" }, now)
    expect(await code(react("stranger"))).toBe("not_found")
    expect(await code(react("host"))).toBe("ok")
  })
})

describe("match polls", () => {
  const input = { matchId: "tsdb-7", question: "Who wins?", options: ["Home", "Away"] }
  const vote = (db: ReturnType<typeof fakeDb>["db"], uid: string, option: unknown = 0) => voteInPoll(db, { matchId: "tsdb-7", uid, option }, now)
  const state = (db: ReturnType<typeof fakeDb>["db"], uid: string | null = null) => getMatchChatState(db, "tsdb-7", uid)

  it("is created by moderators only, with a second factor", async () => {
    const { db } = fakeDb()
    expect(await code(createPoll(db, member, input, now))).toBe("forbidden")
    expect(await code(createPoll(db, noSecondFactor, input, now))).toBe("mfa_required")
    expect(await code(createPoll(db, moderator, input, now))).toBe("ok")
    expect(await code(closePoll(db, member, { matchId: "tsdb-7" }))).toBe("forbidden")
  })

  it("allows one open poll per match and validates its options", async () => {
    const { db } = fakeDb()
    expect(await code(createPoll(db, moderator, { ...input, options: ["Only"] }, now))).toBe("invalid_poll")
    expect(await code(createPoll(db, moderator, { ...input, options: ["Same", "Same"] }, now))).toBe("invalid_poll")
    expect(await code(createPoll(db, moderator, { ...input, options: ["a", "b", "c", "d", "e"] }, now))).toBe("invalid_poll")
    await createPoll(db, moderator, input, now)
    expect(await code(createPoll(db, moderator, input, now))).toBe("poll_open")
    await closePoll(db, moderator, { matchId: "tsdb-7" })
    expect(await code(createPoll(db, moderator, input, later(1000)))).toBe("ok")
    expect((await state(db))?.poll).toMatchObject({ open: true })
  })

  it("keeps one vote per user, even concurrently, and tallies per option", async () => {
    const { db } = fakeDb()
    await createPoll(db, moderator, input, now)
    const results = await Promise.allSettled([vote(db, "u1"), vote(db, "u1", 1), vote(db, "u1")])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(await code(vote(db, "u1", 1))).toBe("already_voted")
    await vote(db, "u2", 1)
    await vote(db, "u3", 1)
    const { poll } = await state(db, "u2")
    expect(poll?.options.reduce((sum, option) => sum + option.votes, 0)).toBe(3)
    expect(poll?.options[1].votes).toBeGreaterThanOrEqual(2)
    expect(poll?.myVote).toBe(1)
  })

  it("refuses bad options, closed polls and sanctioned users, and hides who made the poll", async () => {
    const { db } = fakeDb()
    await createPoll(db, moderator, input, now)
    expect(await code(vote(db, "u1", 2))).toBe("invalid_vote")
    expect(await code(vote(db, "u1", "0"))).toBe("invalid_vote")
    await sanctionUser(db, { uid: "s", type: "suspend", hours: 1, reason: "abuse", actorUid: "mod" }, now)
    expect(await code(vote(db, "s"))).toBe("sanctioned")
    expect(JSON.stringify(await state(db))).not.toContain(moderator.uid)
    await closePoll(db, moderator, { matchId: "tsdb-7" })
    expect(await code(vote(db, "u1"))).toBe("poll_closed")
  })
})

describe("pinned notice", () => {
  it("is set and cleared by moderators only and never shows who pinned it", async () => {
    const { db } = fakeDb()
    const pin = (actor: AuthedUser, text: string | null) => setPinnedNotice(db, actor, { matchId: "tsdb-7", text }, now)
    expect(await code(pin(member, "x"))).toBe("forbidden")
    expect(await code(pin(noSecondFactor, "x"))).toBe("mfa_required")
    expect((await getMatchChatState(db, "tsdb-7", null)).notice).toBeNull()
    await pin(moderator, "Kickoff delayed")
    const { notice } = await getMatchChatState(db, "tsdb-7", null)
    expect(notice?.text).toBe("Kickoff delayed")
    expect(JSON.stringify(notice)).not.toContain(moderator.uid)
    expect(await code(pin(member, null))).toBe("forbidden")
    await pin(moderator, null)
    expect((await getMatchChatState(db, "tsdb-7", null)).notice).toBeNull()
  })

  it("does not disturb the lock on the same chat", async () => {
    const { db } = fakeDb()
    await setLock(db, { scope: "match", scopeId: "tsdb-7", locked: true, reason: "raid", actorUid: "mod" }, now)
    await setPinnedNotice(db, moderator, { matchId: "tsdb-7", text: "Calm down" }, now)
    expect((await getMatchChatState(db, "tsdb-7", null)).locked).toBe(true)
  })
})

describe("unblock", () => {
  const seed = async () => {
    const fake = fakeDb()
    const { id } = await postMatchMessage(fake.db, { matchId: "tsdb-7", uid: "author", displayName: "Sam", text: "hi" }, now)
    await blockAuthor(fake.db, { scope: "match", scopeId: "tsdb-7", messageId: id, uid: "viewer" })
    return fake
  }
  const visible = async (db: ReturnType<typeof fakeDb>["db"]) => (await listMessages(db, { scope: "match", scopeId: "tsdb-7", viewerUid: "viewer" })).messages.length

  it("lists names without uids and restores the person's messages", async () => {
    const { db } = await seed()
    expect(await visible(db)).toBe(0)
    const list = await listBlocked(db, "viewer")
    expect(list).toEqual([{ ref: expect.stringMatching(OPAQUE_REF), displayName: "Sam" }])
    expect(JSON.stringify(list)).not.toContain("author")
    await unblockAuthor(db, { uid: "viewer", ref: list[0].ref })
    expect(await visible(db)).toBe(1)
    expect(await listBlocked(db, "viewer")).toEqual([])
  })

  it("refuses a ref that is not on this person's own list", async () => {
    const { db } = await seed()
    const [{ ref }] = await listBlocked(db, "viewer")
    expect(await code(unblockAuthor(db, { uid: "viewer", ref: "0".repeat(32) }))).toBe("not_found")
    expect(await code(unblockAuthor(db, { uid: "someone", ref }))).toBe("not_found")
  })
})

describe("data rights", () => {
  const seed = async () => {
    const fake = fakeDb()
    const { db } = fake
    const room = await createRoom(db, { uid: "gone", displayName: "Gone", plan: "plus", matchId: "tsdb-7", name: "Sam's room", kickoffUTC: null }, now)
    const other = await createRoom(db, { uid: "stay", displayName: "Stay", plan: "plus", matchId: "tsdb-7", name: "Other", kickoffUTC: null }, now)
    await joinRoom(db, { uid: "stay", displayName: "Stay", token: room.inviteToken, hostPlan: async () => "plus" }, now)
    await joinRoom(db, { uid: "gone", displayName: "Gone", token: other.inviteToken, hostPlan: async () => "plus" }, now)
    const plain = await postMatchMessage(db, { matchId: "tsdb-7", uid: "gone", displayName: "Gone", text: "plain" }, now)
    const reported = await postMatchMessage(db, { matchId: "tsdb-8", uid: "gone", displayName: "Gone", text: "reported" }, now)
    const removed = await postMatchMessage(db, { matchId: "tsdb-7", uid: "gone", displayName: "Gone", text: "removed" }, later(6000))
    const kept = await postMatchMessage(db, { matchId: "tsdb-7", uid: "stay", displayName: "Stay", text: "kept" }, now)
    await postRoomMessage(db, { roomId: other.id, uid: "gone", text: "in a room" }, now)
    await reportMessage(db, { scope: "match", scopeId: "tsdb-8", messageId: reported.id, reporterUid: "stay", reason: "abuse" }, now)
    await removeMessage(db, { scope: "match", scopeId: "tsdb-7", messageId: removed.id, reason: "abuse", actorUid: "mod-uid" }, now)
    await reactToMessage(db, { scope: "match", scopeId: "tsdb-7", messageId: kept.id, uid: "gone", reaction: "like" }, now)
    await submitPrediction(db, { uid: "gone", displayName: "Gone", event: match(), home: 2, away: 1 }, now)
    await settleMatch(db, match({ status: "finished", score: { kind: "team", home: 2, away: 1 } }))
    await blockAuthor(db, { scope: "match", scopeId: "tsdb-7", messageId: kept.id, uid: "gone" })
    await blockAuthor(db, { scope: "match", scopeId: "tsdb-7", messageId: plain.id, uid: "stay" })
    await createPoll(db, moderator, { matchId: "tsdb-7", question: "Q?", options: ["A", "B"] }, now)
    await voteInPoll(db, { matchId: "tsdb-7", uid: "gone", option: 1 }, now)
    return { ...fake, room, other, plain, reported, removed, kept }
  }
  const message = (s: Awaited<ReturnType<typeof seed>>, matchId: string, id: string) => s.docs.get(`match_chats/${matchId}/messages/${id}`)

  it("anonymizes messages, blanking text unless moderation needs it", async () => {
    const s = await seed()
    await eraseCommunityData(s.db, "gone")
    expect(message(s, "tsdb-7", s.plain.id)).toMatchObject({ uid: "", displayName: FORMER_MEMBER, text: "", formerMember: true })
    expect(message(s, "tsdb-8", s.reported.id)).toMatchObject({ uid: "", displayName: FORMER_MEMBER, text: "reported" })
    expect(message(s, "tsdb-7", s.removed.id)).toMatchObject({ uid: "", displayName: FORMER_MEMBER, text: "removed" })
    expect(message(s, "tsdb-7", s.kept.id)).toMatchObject({ uid: "stay", text: "kept" })
    const room = [...s.docs.entries()].filter(([path]) => path.startsWith(`rooms/${s.other.id}/messages/`))
    expect(room.map(([, doc]) => doc)).toEqual([expect.objectContaining({ uid: "", displayName: FORMER_MEMBER, text: "" })])
  })

  it("shows other readers no retained text and no way to act on the author", async () => {
    const s = await seed()
    await eraseCommunityData(s.db, "gone")
    const seen = (await listMessages(s.db, { scope: "match", scopeId: "tsdb-8", viewerUid: "stay" })).messages[0]
    expect(seen).toMatchObject({ text: "", displayName: FORMER_MEMBER, formerMember: true, mine: false })
    expect(await code(blockAuthor(s.db, { scope: "match", scopeId: "tsdb-8", messageId: s.reported.id, uid: "stay" }))).toBe("not_found")
  })

  it("deletes predictions, points, memberships, blocks, reactions and votes, and leaves nothing that names the uid", async () => {
    const s = await seed()
    await eraseCommunityData(s.db, "gone")
    const left = [...s.docs.entries()].filter(([path, doc]) => path.includes("gone") || JSON.stringify(doc).includes('"gone"'))
    expect(left.map(([path]) => path.split("/")[0]).sort()).toEqual(["community_reports"])
    expect(message(s, "tsdb-7", s.kept.id)?.reactionCounts).toEqual({ like: 0 })
    expect((await getMatchChatState(s.db, "tsdb-7", null)).poll?.options[1].votes).toBe(0)
  })

  it("closes rooms the person hosted and frees their place in others", async () => {
    const s = await seed()
    await eraseCommunityData(s.db, "gone")
    expect(s.docs.get(`rooms/${s.room.id}`)).toMatchObject({ status: "closed", hostUid: "", name: "", inviteHash: null })
    expect(s.docs.get(`rooms/${s.other.id}`)).toMatchObject({ status: "active", memberCount: 1 })
    expect(await code(joinRoom(s.db, { uid: "new", displayName: "N", token: s.room.inviteToken, hostPlan: async () => "plus" }, now))).toBe("invite_invalid")
  })

  it("keeps enforcement records and is safe to run twice", async () => {
    const s = await seed()
    await sanctionUser(s.db, { uid: "gone", type: "mute", hours: 1, reason: "spam", actorUid: "mod" }, now)
    await eraseCommunityData(s.db, "gone")
    await eraseCommunityData(s.db, "gone")
    expect(s.docs.has("community_sanctions/gone")).toBe(true)
    expect(await listOpenReports(s.db)).toHaveLength(1)
  })

  it("exports the person's messages, rooms and predictions and nobody else's data", async () => {
    const s = await seed()
    const data = await exportCommunityData(s.db, "gone")
    expect(data.messages.map((row) => row.text).sort()).toEqual(["in a room", "plain", "removed", "reported"])
    expect(data.messages.find((row) => row.text === "removed")?.removedByModerator).toBe(true)
    expect(data.rooms.map((row) => [row.name, row.role]).sort()).toEqual([["Other", "member"], ["Sam's room", "host"]])
    expect(data.predictions).toEqual([expect.objectContaining({ matchId: "tsdb-7", home: 2, away: 1, points: 5 })])
    expect(data.reactions).toEqual([expect.objectContaining({ reaction: "like" })])
    expect(data.pollVotes).toEqual([expect.objectContaining({ option: 1 })])
    expect(data.blockedPeople).toEqual(["Stay"])
    const text = JSON.stringify(data)
    expect(text).not.toMatch(/mod-uid|inviteHash|"stay"/)
  })
})

describe("room pass sales", () => {
  const env = (community?: string) => ({ STRIPE_PRICE_ROOM_PASS: "price_test", COMMUNITY_ENABLED: community })

  it("goes on sale only with the community flag on", () => {
    expect(addonOnSale("room_pass", env("true"))).toBe(true)
    expect(addonOnSale("room_pass", env("false"))).toBe(false)
    expect(addonOnSale("room_pass", env())).toBe(false)
  })
  it("still needs a configured price", () => {
    expect(addonOnSale("room_pass", { COMMUNITY_ENABLED: "true" })).toBe(false)
  })
})

describe("firestore behaviour", () => {
  it("settles matches that have started before ones still to come", async () => {
    const { db, put } = fakeDb()
    put("predictions/tsdb-1_a", { matchId: "tsdb-1", settled: false, lockedAtUTC: later(DAY).toISOString() })
    put("predictions/tsdb-2_a", { matchId: "tsdb-2", settled: false, lockedAtUTC: later(-DAY).toISOString() })
    put("predictions/tsdb-3_a", { matchId: "tsdb-3", settled: false, lockedAtUTC: later(-2 * DAY).toISOString() })
    expect(await pendingMatchIds(db, 20, now)).toEqual(["tsdb-3", "tsdb-2"])
  })

  it("rejects what real Firestore would reject", async () => {
    const { db } = fakeDb()
    await expect(db.set("a/b", { value: undefined })).rejects.toThrow()
    await expect(db.query("a", { where: [["x", 1]], orderBy: { field: "y", direction: "asc" } })).rejects.toThrow()
  })

  it("merges nested maps key by key", async () => {
    const { db, docs } = fakeDb()
    await db.set("a/b", { map: { one: 1, two: 2 } })
    await db.set("a/b", { map: { one: 3 } }, { merge: true })
    expect(docs.get("a/b")).toEqual({ map: { one: 3, two: 2 } })
  })
})

describe("room views", () => {
  it("gives hosts opaque member refs that resolve only within the room", async () => {
    const { db } = fakeDb()
    const { id, inviteToken } = await createRoom(db, { uid: "host", displayName: "H", plan: "plus", matchId: "tsdb-7", name: "R", kickoffUTC: null }, now)
    await joinRoom(db, { uid: "u1", displayName: "U", token: inviteToken, hostPlan: async () => "plus" }, now)
    const view = await getRoomAsMember(db, id, "host")
    expect(JSON.stringify(view)).not.toMatch(/u1|hostUid/)
    const target = view.members.find((row) => row.role === "member")
    expect(await resolveMemberRef(db, id, target?.ref as string)).toBe("u1")
    expect(await code(resolveMemberRef(db, id, "0".repeat(32)))).toBe("not_found")
  })

  it("does not reveal which moderator locked a room", async () => {
    const { db } = fakeDb()
    const { id } = await createRoom(db, { uid: "host", displayName: "H", plan: "plus", matchId: "tsdb-7", name: "R", kickoffUTC: null }, now)
    await setLock(db, { scope: "room", scopeId: id, locked: true, reason: "private note", actorUid: "mod-uid" }, now)
    expect(JSON.stringify(await getRoomAsMember(db, id, "host"))).not.toMatch(/mod-uid|private note/)
  })
})

describe("staff roles", () => {
  const request = () => new Request("https://flacronsport.test/api", { headers: { authorization: "Bearer t" } })
  const token = (role: string | undefined, secondFactor?: string) => ({ uid: "s", role, firebase: { sign_in_second_factor: secondFactor } })
  const failure = async (promise: Promise<unknown>) => code(promise)

  beforeEach(() => verifyIdToken.mockReset())

  it("refuses a moderator without a second factor", async () => {
    verifyIdToken.mockResolvedValue(token("moderator"))
    expect(await failure(requireRole(request(), "moderator"))).toBe("mfa_required")
  })

  it.each(["moderator", "editor"])("accepts a %s with a second factor", async (role) => {
    verifyIdToken.mockResolvedValue(token(role, "totp"))
    await expect(requireRole(request(), role as "moderator")).resolves.toMatchObject({ uid: "s", role })
  })

  it("keeps roles apart", async () => {
    verifyIdToken.mockResolvedValue(token("editor", "totp"))
    expect(await failure(requireRole(request(), "moderator"))).toBe("forbidden")
    verifyIdToken.mockResolvedValue(token("moderator", "totp"))
    expect(await failure(requireRole(request(), "admin"))).toBe("forbidden")
    expect(await failure(requireAdmin(request()))).toBe("forbidden")
  })

  it("lets an admin act as any staff role, still with a second factor", async () => {
    verifyIdToken.mockResolvedValue(token("admin", "totp"))
    await expect(requireRole(request(), "moderator")).resolves.toMatchObject({ role: "admin" })
    verifyIdToken.mockResolvedValue(token("admin"))
    expect(await failure(requireRole(request(), "editor"))).toBe("mfa_required")
  })

  it("refuses an ordinary user and an unknown claim", () => {
    const user = (role?: string) => ({ uid: "u", email: null, emailVerified: true, token: token(role, "totp") }) as unknown as Parameters<typeof assertRole>[0]
    expect(() => assertRole(user(), "moderator")).toThrow()
    expect(() => assertRole(user("superuser"), "moderator")).toThrow()
  })
})

describe("editor report review", () => {
  const seed = (fields: object = {}) => {
    const fake = fakeDb()
    fake.put("reports/r1", { locale: "en", body: "Final score", publishedAt: null, status: "draft", feedKey: null, ...fields })
    return fake
  }
  const review = (db: ReturnType<typeof fakeDb>["db"], status: "published" | "corrected" | "rejected", note: string | null = null) =>
    reviewReport(db, { id: "r1", status, note, actorUid: "editor" }, now)

  it("publishes with the fields the public feed needs and locks out the job", async () => {
    const { db, docs } = seed()
    await review(db, "published")
    expect(docs.get("reports/r1")).toMatchObject({ status: "published", feedKey: `en#${now.toISOString()}`, editedAt: now.toISOString() })
  })
  it("requires a note for a correction and keeps the original publish date", async () => {
    const { db, docs } = seed({ publishedAt: "2026-11-01T00:00:00.000Z" })
    expect(await code(review(db, "corrected"))).toBe("note_required")
    await review(db, "corrected", "Score fixed")
    expect(docs.get("reports/r1")).toMatchObject({ correctionNote: "Score fixed", publishedAt: "2026-11-01T00:00:00.000Z" })
  })
  it("takes a rejected report out of the public feed", async () => {
    const { db, docs } = seed({ status: "published", feedKey: "en#x" })
    await review(db, "rejected")
    expect(docs.get("reports/r1")).toMatchObject({ status: "rejected", feedKey: null })
  })
  it("refuses to publish a report with no text, or one that does not exist", async () => {
    expect(await code(review(seed({ body: "" }).db, "published"))).toBe("nothing_to_publish")
    expect(await code(review(fakeDb().db, "published"))).toBe("not_found")
  })
})

describe("billing health totals", () => {
  it("never merges currencies or test and live money", () => {
    const lines = sumMoney(
      [{ amountPaid: 100, currency: "usd", livemode: false }, { amountPaid: 50, currency: "USD", livemode: false }, { amountPaid: 70, currency: "usd", livemode: true }, { amountPaid: 9, currency: "eur", livemode: true }],
      (row) => row.amountPaid,
    )
    expect(lines).toEqual([
      { currency: "eur", livemode: true, minorUnits: 9, count: 1 },
      { currency: "usd", livemode: true, minorUnits: 70, count: 1 },
      { currency: "usd", livemode: false, minorUnits: 150, count: 2 },
    ])
  })
  it("skips rows with no amount rather than counting them as zero", () => {
    expect(sumMoney([{ amountPaid: null, currency: "usd" }], (row) => row.amountPaid)).toEqual([])
  })
})

describe("pdf export rendering", () => {
  it("produces a real PDF, including names outside the font's character set", async () => {
    const { renderMatchSummaryPdf, pdfSafe } = await import("@/lib/exports/service")
    const bytes = await renderMatchSummaryPdf({ title: "Projekt Warsaw / Ślepsk Suwałki", competition: "PlusLiga", kickoffUTC: "2026-11-05T18:00:00.000Z", status: "finished", score: "3 - 1", venue: null })
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-")
    expect(pdfSafe("Ślepsk Suwałki 東京")).toBe("Slepsk Suwalki ??")
  }, 30_000)
})
