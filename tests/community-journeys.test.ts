// Synthetic users, events and an in-memory store for isolated tests only.
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeDb } from "./fake-db"

const plans: Record<string, string> = { basic: "basic", plus: "plus", premium: "premium", none: "none", unverified: "plus" }
const store = vi.hoisted(() => ({ db: null as unknown }))
const getEvent = vi.hoisted(() => vi.fn())

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => null,
  getAdminAuth: () => ({ verifyIdToken: async (token: string) => ({ uid: token, email_verified: token !== "unverified" }) }),
}))
vi.mock("@/lib/doc-db", () => ({ firestoreDocDb: () => store.db }))
vi.mock("@/lib/billing/firestore-store", () => ({
  getEffectiveAccess: async (uid: string) => ({ plan: plans[uid] ?? "none" }),
  getUserPurchases: async () => [],
}))
vi.mock("@/lib/sports/service", () => ({ getEvent, getRecentEntrants: async () => [] }))

import { GET as accepted, POST as accept } from "@/app/api/community/accept/route"
import { POST as postChat } from "@/app/api/matches/[id]/chat/route"
import { GET as mine } from "@/app/api/predictions/mine/route"
import { POST as createRoomRoute } from "@/app/api/rooms/route"
import { ApiError, type ApiError as ApiErrorType } from "@/lib/api-auth"
import { displayNameOf } from "@/lib/community/content"
import { getMatchChatState } from "@/lib/community/engagement"
import { pickWords } from "@/lib/community/pick-words"
import { listMyPredictions, predictionStatus, submitPrediction, type Prediction } from "@/lib/community/predictions"
import { createRoom, decideRoomSlot, getRoomAsMember, joinRoom, postRoomMessage } from "@/lib/community/rooms"
import { rankUpcoming } from "@/lib/community/upcoming"
import { getDictionary } from "@/lib/i18n"
import type { SportEvent } from "@/lib/sports/types"

const now = new Date("2026-11-05T12:00:00Z")
const HOUR = 3_600_000
const at = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString()
const words = getDictionary("en").community
const french = getDictionary("fr").community

const game = (overrides: Partial<SportEvent> = {}) => ({
  id: "tsdb-7", sportId: "football", eventType: "match", participantType: "team",
  participants: [{ id: "1", name: "Lions", role: "home", badgeUrl: null }, { id: "2", name: "Hawks", role: "away", badgeUrl: null }],
  competition: { id: "9", name: "Local Cup", country: null },
  scheduledStartUTC: at(24), status: "scheduled", providerStatus: "NS", score: { kind: "none" }, venue: null,
  provider: { name: "feed", eventId: "7" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
}) as SportEvent

const stored = (overrides: Partial<Prediction>): Prediction => ({
  uid: "plus", displayName: "P", matchId: "tsdb-1", home: 1, away: 0, createdAtUTC: at(-48), lockedAtUTC: at(24),
  scoringVersion: 1, settled: false, settledKey: null, voided: false, points: 0, ...overrides,
})

const request = (token: string | null, path = "http://test.invalid/api", init: RequestInit = {}) =>
  new Request(path, { ...init, headers: token ? { authorization: `Bearer ${token}` } : {} })

const code = async (promise: Promise<unknown>) => promise.then(() => "ok", (error) => (error as ApiErrorType).code)

beforeEach(() => {
  vi.stubEnv("COMMUNITY_ENABLED", "true")
  store.db = fakeDb().db
  getEvent.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

describe("GET /api/community/accept", () => {
  it("says no until the member confirms, and yes afterwards", async () => {
    expect(await (await accepted(request("plus"))).json()).toEqual({ accepted: false })
    const body = JSON.stringify({ ageConfirmed: true, guidelinesAccepted: true })
    expect((await accept(new Request("http://test.invalid/api", { method: "POST", body, headers: { authorization: "Bearer plus" } }))).status).toBe(200)
    expect(await (await accepted(request("plus"))).json()).toEqual({ accepted: true })
  })

  it("refuses a visitor, an unverified account and an account with no plan", async () => {
    expect((await accepted(request(null))).status).toBe(401)
    expect(((await accepted(request("unverified"))).status)).toBe(403)
    expect((await accepted(request("none"))).status).toBe(402)
  })

  it("is off with the community flag", async () => {
    vi.stubEnv("COMMUNITY_ENABLED", "false")
    expect((await accepted(request("plus"))).status).toBe(503)
  })
})

describe("GET /api/predictions/mine", () => {
  const url = "http://test.invalid/api/predictions/mine"

  it("needs a signed-in member with a plan", async () => {
    expect((await mine(request(null, url))).status).toBe(401)
    expect((await mine(request("none", url))).status).toBe(402)
  })

  it("names no composite index and is rate limited", () => {
    const source = readFileSync("app/api/predictions/mine/route.ts", "utf8")
    expect(source).toMatch(/requireSubscriber\(user\.uid\)/)
    expect(source).toMatch(/rateLimit\(/)
    expect(readFileSync("lib/community/predictions.ts", "utf8")).toMatch(/query<Prediction>\("predictions", \{ where: \[\["uid", uid\]\] \}\)/)
  })

  it("returns only the caller's picks, with no uid, and the empty list for a new member", async () => {
    const { db, put } = fakeDb({ acceptEveryone: true })
    store.db = db
    expect(await (await mine(request("plus", url))).json()).toEqual({ predictions: [] })
    await submitPrediction(db, { uid: "plus", displayName: "P", event: game(), home: 2, away: 1 }, now)
    put("predictions/tsdb-9_other", stored({ uid: "other", matchId: "tsdb-9" }))
    const body = await (await mine(request("plus", url))).text()
    expect(JSON.parse(body).predictions).toHaveLength(1)
    expect(JSON.parse(body).predictions[0].game).toEqual({ title: "Lions / Hawks", home: "Lions", away: "Hawks" })
    expect(body).not.toMatch(/"uid"|other/)
    expect(getEvent).not.toHaveBeenCalled()
  })

  it("reads every status from the entry and shows points only once settled", async () => {
    const { db, put } = fakeDb()
    put("predictions/a", stored({ matchId: "tsdb-1", lockedAtUTC: at(48), game: { title: "Later", home: "A", away: "B" } }))
    put("predictions/b", stored({ matchId: "tsdb-2", lockedAtUTC: at(2), game: { title: "Soon", home: "A", away: "B" } }))
    put("predictions/c", stored({ matchId: "tsdb-3", lockedAtUTC: at(-2), game: { title: "Started", home: "A", away: "B" } }))
    put("predictions/d", stored({ matchId: "tsdb-4", lockedAtUTC: at(-1), settled: true, points: 5, game: { title: "Won", home: "A", away: "B" } }))
    put("predictions/e", stored({ matchId: "tsdb-5", lockedAtUTC: at(-30), settled: true, voided: true, game: { title: "Off", home: "A", away: "B" } }))
    const rows = await listMyPredictions(db, "plus", now, async () => null)
    expect(rows.map((row) => [row.game?.title, row.status, row.points])).toEqual([
      ["Soon", "open", null], ["Later", "open", null], ["Won", "settled", 5], ["Started", "locked", null], ["Off", "void", null],
    ])
  })

  it("looks up a game only for an older entry, and a failed lookup keeps the pick", async () => {
    const { db, put } = fakeDb()
    put("predictions/a", stored({ matchId: "tsdb-7" }))
    put("predictions/b", stored({ matchId: "tsdb-8" }))
    const lookup = vi.fn(async (id: string) => {
      if (id === "tsdb-8") throw new Error("feed down")
      return game()
    })
    const rows = await listMyPredictions(db, "plus", now, lookup)
    expect(rows.find((row) => row.matchId === "tsdb-7")?.game?.home).toBe("Lions")
    expect(rows.find((row) => row.matchId === "tsdb-8")?.game).toBeNull()
  })

  it("treats a void entry as void even if it was also settled", () => {
    expect(predictionStatus({ settled: true, voided: true, lockedAtUTC: at(-1) }, now)).toBe("void")
  })

  it("keeps a race, which has no sides, free of undefined values", async () => {
    const { db, docs } = fakeDb({ acceptEveryone: true })
    const race = game({ sportId: "motorsport", participantType: "individual", participants: [], eventType: "session", eventName: "Grand Prix", details: { kind: "motorsport", session: "race" } } as unknown as Partial<SportEvent>)
    const entrants = ["Ana", "Bo", "Cy"]
    await submitPrediction(db, { uid: "plus", displayName: "P", event: race, podium: entrants, entrants }, now)
    expect(docs.get("predictions/tsdb-7_plus")?.game).toEqual({ title: "Grand Prix", home: null, away: null })
  })
})

describe("pick wording", () => {
  const empty = { home: null, away: null, winner: null, podium: null }
  const teams = { home: "Lions", away: "Hawks" }

  it("names the teams beside a score", () => {
    expect(pickWords({ ...empty, home: 2, away: 1 }, teams, words)).toBe("Lions 2 – 1 Hawks")
    expect(pickWords({ ...empty, home: 0, away: 0 }, teams, words)).toBe("Lions 0 – 0 Hawks")
  })

  it("falls back to the score alone when the game could not be read", () => {
    expect(pickWords({ ...empty, home: 2, away: 1 }, null, words)).toBe("2 – 1")
  })

  it("says who wins, in both languages", () => {
    expect(pickWords({ ...empty, winner: "Ana" }, teams, words)).toBe("Ana to win")
    expect(pickWords({ ...empty, winner: "Ana" }, teams, french)).toBe("Victoire de Ana")
  })

  it("gives each podium place", () => {
    expect(pickWords({ ...empty, podium: ["Ana", "Bo", "Cy"] }, null, words)).toBe("1st place: Ana, 2nd place: Bo, 3rd place: Cy")
  })
})

describe("room creation limits", () => {
  const url = "http://test.invalid/api/rooms"
  const post = (token: string, body: object) => createRoomRoute(new Request(url, { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } }))
  const base = { matchId: "tsdb-7", name: "Watch party" }
  const room = (uid: string, plan: "basic" | "plus" | "premium", participantLimit?: number) =>
    createRoom(store.db as never, { uid, displayName: "H", plan, matchId: "tsdb-7", name: "R", participantLimit, kickoffUTC: null }, now)

  beforeEach(() => {
    store.db = fakeDb({ acceptEveryone: true }).db
    getEvent.mockResolvedValue(game())
  })

  it("refuses Basic with the code the page explains", async () => {
    const response = await post("basic", base)
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe("plan_required")
  })

  it("lets Plus create and hands back the invitation once", async () => {
    const response = await post("plus", base)
    const data = await response.json()
    expect(response.status).toBe(201)
    expect(data.inviteToken).toEqual(expect.any(String))
    expect(data.participantCap).toBe(20)
  })

  it("stops at three active rooms on Plus and ten on Premium", async () => {
    for (let index = 0; index < 3; index += 1) await room("plus", "plus")
    expect(await code(room("plus", "plus"))).toBe("room_limit")
    for (let index = 0; index < 10; index += 1) await room("premium", "premium")
    expect(await code(room("premium", "premium"))).toBe("room_limit")
  })

  it("holds the participant limit to the plan", async () => {
    expect((await room("plus", "plus", 50)).room.participantCap).toBe(20)
    expect((await room("plus", "plus", 5)).room.participantCap).toBe(5)
    expect((await room("premium", "premium", 50)).room.participantCap).toBe(50)
  })

  it("explains a finished game, and refuses it before any room exists", async () => {
    getEvent.mockResolvedValue(game({ status: "finished" }))
    const response = await post("plus", base)
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe("match_over")
  })

  it("gives Basic a slot only through a room pass", () => {
    expect(() => decideRoomSlot("basic", 0, [])).toThrow(ApiError)
  })
})

describe("who is in a room", () => {
  const invite = async () => {
    const { db } = fakeDb({ acceptEveryone: true })
    const { id, inviteToken } = await createRoom(db, { uid: "host", displayName: "Hana", plan: "plus", matchId: "tsdb-7", name: "R", kickoffUTC: null }, now)
    await joinRoom(db, { uid: "guest", displayName: "Gil", token: inviteToken, hostPlan: async () => "plus" }, now)
    return { db, id }
  }

  it("shows every member their fellow members right after joining, host first", async () => {
    const { db, id } = await invite()
    const view = await getRoomAsMember(db, id, "guest")
    expect(view.members.map(({ displayName, role, mine: own }) => ({ displayName, role, own }))).toEqual([
      { displayName: "Hana", role: "host", own: false },
      { displayName: "Gil", role: "member", own: true },
    ])
    expect(JSON.stringify(view)).not.toMatch(/guest|hostUid/)
  })

  it("carries a name chosen after joining into the room", async () => {
    const { db, id } = await invite()
    await postRoomMessage(db, { roomId: id, uid: "guest", text: "hello", displayName: "Gilbert" }, now)
    expect((await getRoomAsMember(db, id, "host")).members[1].displayName).toBe("Gilbert")
  })

  it("refuses a new message once the room has run out, while its history stays", async () => {
    const { db, id } = await invite()
    expect(await code(postRoomMessage(db, { roomId: id, uid: "guest", text: "late" }, new Date(now.getTime() + 25 * HOUR)))).toBe("room_expired")
    expect((await getRoomAsMember(db, id, "guest")).members).toHaveLength(2)
  })
})

describe("match chat", () => {
  const send = (token: string) => postChat(
    new Request("http://test.invalid/api/matches/tsdb-7/chat", { method: "POST", body: JSON.stringify({ text: "Come on" }), headers: { authorization: `Bearer ${token}` } }),
    { params: Promise.resolve({ id: "tsdb-7" }) },
  )

  beforeEach(() => {
    store.db = fakeDb({ acceptEveryone: true }).db
  })

  it("posts through a feed outage, since a message depends on no kickoff", async () => {
    getEvent.mockRejectedValue(new Error("feed down"))
    expect((await send("plus")).status).toBe(201)
  })

  it("still refuses a game that does not exist", async () => {
    getEvent.mockResolvedValue(null)
    expect((await send("plus")).status).toBe(404)
  })

  it("counts the people taking part, once each", async () => {
    getEvent.mockResolvedValue(game())
    await send("plus")
    await send("premium")
    expect((await getMatchChatState(store.db as never, "tsdb-7", "plus")).participants).toBe(2)
  })

  it("tells two nameless members apart without showing anything of their account", () => {
    const first = displayNameOf({ uid: "account-one", email: "a@test.invalid" })
    expect(first).toMatch(/^Fan [a-f0-9]{4}$/)
    expect(first).not.toBe(displayNameOf({ uid: "account-two" }))
    expect(displayNameOf({ uid: "account-one", name: "Sam" })).toBe("Sam")
  })
})

describe("upcoming games", () => {
  const following = { favorites: ["Hawks"], leagues: [], players: [] }
  const major = game({ id: "tsdb-2", scheduledStartUTC: at(30), competition: { id: "2", name: "English Premier League", country: null }, participants: [{ id: "3", name: "Reds", role: "home", badgeUrl: null }, { id: "4", name: "Blues", role: "away", badgeUrl: null }] })
  const followed = game({ id: "tsdb-3", scheduledStartUTC: at(60) })

  it("puts followed teams first, then major competitions, then the rest", () => {
    const quiet = game({ id: "tsdb-1", scheduledStartUTC: at(5), participants: [{ id: "5", name: "Foxes", role: "home", badgeUrl: null }, { id: "6", name: "Owls", role: "away", badgeUrl: null }] })
    expect(rankUpcoming([quiet, major, followed], following, now).map((item) => item.id)).toEqual(["tsdb-3", "tsdb-2", "tsdb-1"])
  })

  it("leaves out games that started, have no real time, or have no teams yet", () => {
    const events = [
      game({ id: "tsdb-4", scheduledStartUTC: at(-1) }),
      game({ id: "tsdb-5", dateOnly: true }),
      game({ id: "tsdb-6", status: "live" }),
      game({ id: "tsdb-8", participants: [{ id: "1", name: "TBD", role: "home", badgeUrl: null }, { id: "2", name: "Hawks", role: "away", badgeUrl: null }] }),
    ]
    expect(rankUpcoming(events, following, now)).toEqual([])
  })

  it("marks whether a pick can be made, and lists a game once", () => {
    const rows = rankUpcoming([followed, followed], following, now)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ followed: true, predictable: true, title: "Lions / Hawks" })
  })
})
