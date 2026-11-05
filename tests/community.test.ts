// Synthetic users, events and an in-memory store for isolated tests only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verifyIdToken = vi.fn()
vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => ({ verifyIdToken }), getAdminDb: () => null }))

import { reviewReport } from "@/lib/admin/report-review"
import { sumMoney } from "@/lib/admin/billing-health"
import { assertRole, requireAdmin, requireFeature, requireRole, type ApiError } from "@/lib/api-auth"
import { ADDONS, buildPurchase, type BillingPurchase } from "@/lib/billing/addons"
import { PLANS, type PlanId } from "@/lib/billing/plans"
import { blockAuthor, listMessages, postMatchMessage, reportMessage } from "@/lib/community/chat"
import { assertId, cleanMessage, containsPiratedStreamLink, displayNameOf, MATCH_ID } from "@/lib/community/content"
import { listOpenReports, removeMessage, sanctionUser, setLock } from "@/lib/community/moderation"
import {
  getLeaderboard, POINTS, scorePrediction, settleMatch, submitPrediction, supportsScorePrediction,
} from "@/lib/community/predictions"
import {
  assertRoomMember, closeRoom, createRoom, getRoomAsMember, joinCap, joinRoom, postRoomMessage, removeMember, revokeInvite,
} from "@/lib/community/rooms"
import type { SportEvent } from "@/lib/sports/types"
import { fakeDb } from "./fake-db"

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
