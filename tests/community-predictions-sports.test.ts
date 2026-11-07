// Predictions must fit each sport: what is offered, what is accepted and how it settles.
import { describe, expect, it, vi } from "vitest"
import { fakeDb } from "./fake-db"
import { refreshBadges } from "@/lib/community/badges"
import { PERFECT_PODIUM, PREDICTION_SPORTS, SCORE_RULES } from "@/lib/community/pick-rules"
import { getLeaderboard, POINTS, predictionKind, settleMatch, submitPrediction, type Prediction } from "@/lib/community/predictions"
import { getDictionary } from "@/lib/i18n"
import { SPORTS, type EventScore, type SportEvent, type SportId } from "@/lib/sports/types"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

const now = new Date()
const DAY = 86_400_000
const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString()
const code = (promise: Promise<unknown>) => promise.then(() => null, (error: { code: string }) => error.code)

const game = (sportId: SportId, overrides: Partial<SportEvent> = {}): SportEvent => ({
  id: "tsdb-7", sportId, eventType: "match", participantType: "team",
  participants: [{ id: null, name: "Harbor", role: "home", badgeUrl: null }, { id: null, name: "Ridge", role: "away", badgeUrl: null }],
  competition: { id: "9", name: "League", country: null }, scheduledStartUTC: new Date(now.getTime() + DAY).toISOString(), status: "scheduled", providerStatus: null,
  score: { kind: "none" }, venue: null, provider: { name: "x", eventId: "7" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
})
const tie = (overrides: Partial<SportEvent> = {}) => game("tennis", { participantType: "entrant", ...overrides })
const race = (session: string) =>
  game("motorsport", { eventType: "session", participantType: "entrant", participants: [], eventName: "Harbor Grand Prix", details: { kind: "motorsport", session } as SportEvent["details"] })
const cricket = (format: string | null, overrides: Partial<SportEvent> = {}) => game("cricket", { details: { kind: "cricket", format } as SportEvent["details"], ...overrides })
const innings = (home: number, away: number, extra: Partial<Extract<EventScore, { kind: "innings" }>> = {}): EventScore =>
  ({ kind: "innings", home: { runs: home, wickets: 5, overs: null }, away: { runs: away, wickets: 5, overs: null }, winner: null, margin: null, ...extra }) as EventScore
const team = (home: number, away: number): EventScore => ({ kind: "team", home, away })
const stored = (uid: string, fields: object) => ({ uid, displayName: uid, matchId: "tsdb-7", ...fields, settled: false, settledKey: null, voided: false, points: 0, lockedAtUTC: ago(1) })

const setup = async (event: SportEvent, pick: object) => {
  const store = fakeDb({ acceptEveryone: true })
  await submitPrediction(store.db, { uid: "u1", displayName: "U", event, ...pick }, now)
  return { ...store, entry: () => store.docs.get("predictions/tsdb-7_u1") as unknown as Prediction }
}

describe("what each sport offers", () => {
  it("lists a score rule only for sports picked by score, and every sport in the filter", () => {
    expect(Object.keys(SCORE_RULES).sort()).toEqual(["american-football", "baseball", "football", "ice-hockey", "rugby", "volleyball"])
    expect([...PREDICTION_SPORTS].sort()).toEqual(SPORTS.map(({ id }) => id).sort())
  })
  it("takes a winner in basketball and for a tennis team tie", () => {
    expect(predictionKind(game("basketball"))).toBe("winner")
    expect(predictionKind(tie())).toBe("winner")
  })
  it("offers limited-overs cricket only, as the published rule says", () => {
    expect(predictionKind(cricket("t20"))).toBe("winner")
    expect(predictionKind(cricket("odi"))).toBe("winner")
    expect(predictionKind(cricket("test"))).toBeNull()
    expect(predictionKind(cricket("first-class"))).toBeNull()
    expect(JSON.stringify(getDictionary("en").community.predictionRuleList)).toContain("in limited-overs games")
    expect(JSON.stringify(getDictionary("fr").community.predictionRuleList)).toContain("formats à overs limités")
  })
  it("takes a podium for a race only", () => {
    expect(predictionKind(race("race"))).toBe("podium")
    for (const session of ["sprint", "qualifying", "practice", "testing"]) expect(predictionKind(race(session))).toBeNull()
    expect(predictionKind({ ...race("race"), details: undefined })).toBeNull()
  })
})

describe("score picks fit the sport", () => {
  const pick = (sportId: SportId, home: number, away: number) => code(submitPrediction(fakeDb({ acceptEveryone: true }).db, { uid: "u1", displayName: "U", event: game(sportId), home, away }, now))

  it.each([["football", 30], ["ice-hockey", 30], ["rugby", 150], ["american-football", 100], ["baseball", 50], ["volleyball", 3]] as [SportId, number][])("caps %s at %i", async (sportId, max) => {
    expect(await pick(sportId, max, 0)).toBeNull()
    expect(await pick(sportId, max + 1, 0)).toBe("invalid_score")
  })
  it.each(["baseball", "volleyball", "american-football"] as SportId[])("refuses a level pick in %s", async (sportId) => {
    expect(await pick(sportId, 1, 1)).toBe("invalid_score")
  })
  it.each(["football", "ice-hockey", "rugby"] as SportId[])("accepts a level pick in %s", async (sportId) => {
    expect(await pick(sportId, 1, 1)).toBeNull()
  })
  it("names the score in sets for volleyball, in both languages", () => {
    expect(SCORE_RULES.volleyball?.unit).toBe("sets")
    expect(getDictionary("en").community.scoreUnits.sets).toBe("Sets won")
    expect(getDictionary("fr").community.scoreUnits.sets).toBe("Sets gagnés")
  })
  it("takes no score for basketball, and stores the sport on a new pick", async () => {
    expect(await pick("basketball", 101, 99)).toBe("invalid_pick")
    const { entry } = await setup(game("basketball"), { winner: "Ridge" })
    expect(entry()).toMatchObject({ kind: "winner", sportId: "basketball", winner: "Ridge" })
  })
})

describe("settlement", () => {
  it("voids an event the feed never confirmed once it is overdue", async () => {
    for (const [event, pick] of [[game("tennis"), { winner: "Harbor" }], [game("football"), { home: 1, away: 0 }]] as [SportEvent, object][]) {
      const { db, entry } = await setup(event, pick)
      expect((await settleMatch(db, { ...event, status: "unknown", scheduledStartUTC: ago(6) })).settled).toBe(0)
      expect((await settleMatch(db, { ...event, status: "unknown", scheduledStartUTC: ago(8) })).settled).toBe(1)
      expect(entry()).toMatchObject({ voided: true, settled: true, points: 0 })
    }
  })
  it("keeps waiting on a live event, however old", async () => {
    const { db } = await setup(game("football"), { home: 1, away: 0 })
    expect((await settleMatch(db, game("football", { status: "live", scheduledStartUTC: ago(30) }))).settled).toBe(0)
  })

  describe("cricket", () => {
    const finished = (score: EventScore, overrides: Partial<SportEvent> = {}) => cricket("t20", { status: "finished", score, scheduledStartUTC: ago(1), ...overrides })

    // A rain-revised target can make the lower total the winner, so totals alone settle nothing.
    it("awards nothing on totals alone", async () => {
      const { db, entry } = await setup(cricket("t20"), { winner: "Harbor" })
      await settleMatch(db, finished(innings(180, 150)))
      expect(entry()?.points ?? 0).toBe(0)
    })
    it("uses a stated winner over the totals", async () => {
      const { db, entry } = await setup(cricket("t20"), { winner: "Ridge" })
      await settleMatch(db, finished(innings(180, 150, { outcome: "won", winner: "Ridge" })))
      expect(entry()).toMatchObject({ voided: false, points: POINTS.winner })
    })
    it.each(["drawn", "tied"] as const)("voids a stated %s at once", async (outcome) => {
      const { db, entry } = await setup(cricket("t20"), { winner: "Harbor" })
      await settleMatch(db, finished(innings(180, 180, { outcome })))
      expect(entry()).toMatchObject({ voided: true })
    })
    it("waits on totals that settle nothing, and voids only when overdue", async () => {
      const { db, entry } = await setup(cricket("t20"), { winner: "Harbor" })
      expect((await settleMatch(db, finished(innings(180, 180)))).settled).toBe(0)
      expect((await settleMatch(db, finished(innings(180, 12)))).settled).toBe(0)
      expect((await settleMatch(db, finished(innings(180, 180), { scheduledStartUTC: ago(8) }))).settled).toBe(1)
      expect(entry()).toMatchObject({ voided: true })
    })
    it("reverses a void when a result arrives", async () => {
      const { db, entry } = await setup(cricket("t20"), { winner: "Harbor" })
      await settleMatch(db, finished(innings(180, 180, { outcome: "tied" })))
      await settleMatch(db, finished(innings(180, 150, { outcome: "won", winner: "Harbor" })))
      expect(entry()).toMatchObject({ voided: false, points: POINTS.winner })
    })
  })

  describe("tennis", () => {
    it("settles a team tie from the rubbers won", async () => {
      const { db, entry } = await setup(tie(), { winner: "Ridge" })
      await settleMatch(db, tie({ status: "finished", score: team(1, 3), scheduledStartUTC: ago(1) }))
      expect(entry()).toMatchObject({ voided: false, points: POINTS.winner })
    })
    it("gives a retirement to the player left standing", async () => {
      const { db, entry } = await setup(game("tennis"), { winner: "Ridge" })
      const lines = [{ name: "Harbor", games: [6] }, { name: "Ridge", games: [3] }]
      await settleMatch(db, game("tennis", { status: "finished", score: { kind: "sets", lines, winner: null, retired: "Harbor" }, scheduledStartUTC: ago(1) }))
      expect(entry()).toMatchObject({ points: POINTS.winner })
    })
  })

  describe("a score nobody entered", () => {
    it.each(["baseball", "volleyball", "american-football", "ice-hockey", "rugby"] as SportId[])("treats a finished 0-0 in %s as no result", async (sportId) => {
      const { db, docs, entry } = await setup(game(sportId), { home: 2, away: 1 })
      expect((await settleMatch(db, game(sportId, { status: "finished", score: team(0, 0), scheduledStartUTC: ago(1) }))).settled).toBe(0)
      expect(docs.has("prediction_points/u1")).toBe(false)
      await settleMatch(db, game(sportId, { status: "finished", score: team(0, 0), scheduledStartUTC: ago(8) }))
      expect(entry()).toMatchObject({ voided: true })
    })
    it("keeps a football 0-0, which is a real result", async () => {
      const { db, entry } = await setup(game("football"), { home: 0, away: 0 })
      await settleMatch(db, game("football", { status: "finished", score: team(0, 0), scheduledStartUTC: ago(1) }))
      expect(entry()).toMatchObject({ voided: false, points: POINTS.exact })
    })
    it("still scores a cup tie level after kicks the source did not give", async () => {
      const { db, entry } = await setup(game("football"), { home: 1, away: 1 })
      await settleMatch(db, game("football", { status: "finished", score: team(1, 1), conclusion: "penalties", scheduledStartUTC: ago(1) }))
      expect(entry()).toMatchObject({ voided: false, points: POINTS.exact })
    })
    it("does not read volleyball points as sets", async () => {
      const { db } = await setup(game("volleyball"), { home: 3, away: 1 })
      expect((await settleMatch(db, game("volleyball", { status: "finished", score: team(25, 21), scheduledStartUTC: ago(1) }))).settled).toBe(0)
    })
  })

  describe("basketball", () => {
    const final = game("basketball", { status: "finished", score: team(101, 99), scheduledStartUTC: ago(1) })

    it("settles a new pick by winner", async () => {
      const { db, entry } = await setup(game("basketball"), { winner: "Harbor" })
      await settleMatch(db, final)
      expect(entry()).toMatchObject({ points: POINTS.winner })
    })
    it("settles a stored score pick by its score, with or without a stored kind", async () => {
      for (const kind of [{ kind: "score" }, {}]) {
        const { db, docs, put } = fakeDb({ acceptEveryone: true })
        put("predictions/tsdb-7_old", stored("old", { ...kind, home: 101, away: 99 }))
        await settleMatch(db, final)
        expect(docs.get("predictions/tsdb-7_old")).toMatchObject({ points: POINTS.exact })
        expect(docs.get("prediction_points/old")).toMatchObject({ points: POINTS.exact, exact: 1 })
      }
    })
    it("settles old and new picks on one game, each by its own kind", async () => {
      const { db, docs, put } = await setup(game("basketball"), { winner: "Ridge" })
      put("predictions/tsdb-7_old", stored("old", { home: 90, away: 80 }))
      expect((await settleMatch(db, final)).settled).toBe(2)
      expect((await settleMatch(db, final)).settled).toBe(0)
      expect(docs.get("predictions/tsdb-7_u1")).toMatchObject({ points: 0, voided: false })
      expect(docs.get("predictions/tsdb-7_old")).toMatchObject({ points: POINTS.outcome })
    })
  })
})

describe("the Sharp badge", () => {
  const entry = (id: number, points: number) => [`predictions/m${id}_a`, { uid: "a", matchId: `m${id}`, points }] as const

  it("counts correct winners and perfect podiums, and nothing lesser", async () => {
    const { db, put } = fakeDb()
    for (let id = 0; id < 3; id += 1) put(...entry(id, POINTS.winner))
    put(...entry(3, PERFECT_PODIUM))
    put(...entry(4, POINTS.outcome))
    put(...entry(5, POINTS.podiumExact))
    expect(await refreshBadges(db, "a", now)).not.toContain("sharp")
    put(...entry(6, POINTS.winner))
    expect(await refreshBadges(db, "a", now)).toContain("sharp")
  })
  it("adds them to exact scores", async () => {
    const { db, put } = fakeDb()
    put("prediction_points/a", { uid: "a", displayName: "a", points: 20, exact: 4 })
    put(...entry(0, POINTS.winner))
    expect(await refreshBadges(db, "a", now)).toContain("sharp")
  })
})

describe("the leaderboard by sport", () => {
  const finished = (sportId: SportId, score: EventScore, overrides: Partial<SportEvent> = {}) => game(sportId, { status: "finished", score, scheduledStartUTC: ago(1), ...overrides })

  it("ranks a sport on its own points and leaves out older picks", async () => {
    const { db, put } = fakeDb({ acceptEveryone: true })
    await submitPrediction(db, { uid: "a", displayName: "Ana", event: game("football"), home: 2, away: 1 }, now)
    put("predictions/tsdb-7_old", stored("old", { home: 2, away: 1 }))
    await settleMatch(db, finished("football", team(2, 1)))

    expect((await getLeaderboard(db)).map(({ displayName }) => displayName).sort()).toEqual(["Ana", "old"])
    expect(await getLeaderboard(db, "football")).toMatchObject([{ rank: 1, displayName: "Ana", points: POINTS.exact }])
    expect(await getLeaderboard(db, "tennis")).toEqual([])
  })
  it("keeps other sports' points when one is settled or corrected", async () => {
    const { db, docs } = fakeDb({ acceptEveryone: true })
    await submitPrediction(db, { uid: "a", displayName: "A", event: game("football"), home: 2, away: 1 }, now)
    await settleMatch(db, finished("football", team(2, 1)))
    await submitPrediction(db, { uid: "a", displayName: "A", event: game("tennis", { id: "tsdb-8" }), winner: "Harbor" }, now)
    await settleMatch(db, finished("tennis", { kind: "sets", lines: [], winner: "Harbor", retired: null }, { id: "tsdb-8" }))
    await settleMatch(db, finished("football", team(3, 1)))
    expect(docs.get("prediction_points/a")).toMatchObject({ points: POINTS.outcome + POINTS.winner, sports: { football: POINTS.outcome, tennis: POINTS.winner } })
  })
})
