// Synthetic events only: each sport's reports read that sport's own score.
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

import { buildRecap } from "@/lib/content/coverage"
import { buildFullReport } from "@/lib/content/full-report"
import { buildReport } from "@/lib/content/reports"
import type { MatchDetail, TimelineItem } from "@/lib/sports/detail"
import type { CombatBout, EventScore, SportEvent } from "@/lib/sports/types"

const NOW = new Date("2026-11-05T18:00:00Z")
const event = (overrides: Partial<SportEvent> = {}): SportEvent => ({
  id: "tsdb-1", sportId: "football", eventType: "match", participantType: "team",
  participants: [{ id: "1", name: "North", role: "home", badgeUrl: null }, { id: "2", name: "South", role: "away", badgeUrl: null }],
  competition: { id: "9", name: "Test League", country: null },
  scheduledStartUTC: "2026-11-05T15:00:00.000Z", status: "finished", providerStatus: "FT",
  score: { kind: "team", home: 2, away: 1 }, venue: null,
  provider: { name: "TheSportsDB", eventId: "1" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
  ...overrides,
})
const detail = (overrides: Partial<MatchDetail> = {}): MatchDetail => ({ state: "ok", timeline: [], stats: [], lineups: { home: [], away: [] }, fetchedAt: NOW.toISOString(), ...overrides })
const innings = (runs: number, wickets: number | null = 10) => ({ runs, wickets, overs: null })
const cricket = (score: Partial<Extract<EventScore, { kind: "innings" }>>) => event({ sportId: "cricket", score: { kind: "innings", home: null, away: null, winner: null, margin: null, ...score } })
const bout = (winner: string, method: CombatBout["method"]): CombatBout => ({ names: [winner, "Other"], winner, method, round: 2, time: "1:30", weightClass: null, scheduledRounds: 3, section: "main", scorecards: null })
const goal = (id: string, side: "home" | "away", extra: Partial<TimelineItem> = {}): TimelineItem => ({ id, minute: 5, kind: "goal", side, player: `P${id}`, secondary: null, ...extra })

const race = event({
  sportId: "motorsport", eventType: "session", participants: [], eventName: "Monaco Grand Prix",
  score: {
    kind: "classification", pole: "Ann", fastestLap: { name: "Bea", time: "1:12.5" },
    entries: [{ position: 1, name: "Ann", team: "Red", time: "1:30:00", grid: 1 }, { position: 2, name: "Bea", team: "Blue", time: "+2.1", grid: 6 }],
    out: [{ name: "Cy", team: null, status: "RET", note: null }],
    standings: [{ position: 1, name: "Ann", points: 120 }],
  },
})
const tennis = event({
  sportId: "tennis", participants: [{ id: "1", name: "Ivo", role: "home", badgeUrl: null }, { id: "2", name: "Jan", role: "away", badgeUrl: null }],
  score: { kind: "sets", lines: [{ name: "Ivo", games: [6, 3, 7] }, { name: "Jan", games: [4, 6, 6] }], winner: "Ivo", retired: null, tiebreaks: [null, null, 5] },
})
const fight = event({
  sportId: "combat-sports", score: { kind: "combat", winner: "North", method: "ko", round: 2, time: "1:30" },
  details: { kind: "combat", discipline: "mma", card: null, bouts: [bout("North", "ko"), bout("West", "unanimous-decision"), bout("East", "submission")], weightClass: null, scheduledRounds: null, title: null, city: null, country: null, season: null, spectators: null },
})
const test = cricket({
  home: innings(600), away: innings(500), winner: "North", margin: { value: 100, unit: "runs" },
  homeInnings: [innings(450), innings(150)], awayInnings: [innings(200), innings(300)],
  playerOfMatch: "Dee",
})

describe("result reports", () => {
  it("reports a drawn or tied cricket match, which has no winner", () => {
    const drawn = buildReport(cricket({ home: innings(300), away: innings(250, 3), outcome: "drawn" }), "en", NOW.toISOString(), NOW)
    expect(drawn.status).toBe("validated")
    expect(drawn.body).toContain("Match drawn")
    expect(buildReport(cricket({ outcome: "tied" }), "fr", NOW.toISOString(), NOW).body).toContain("Égalité")
  })
  it("reports a stated winner with no totals, and still refuses a match with neither", () => {
    expect(buildReport(cricket({ winner: "North", margin: { value: 5, unit: "wickets" }, outcome: "won" }), "en", NOW.toISOString(), NOW)).toMatchObject({ status: "validated", body: expect.stringContaining("North won by 5 wickets") })
    expect(buildReport(cricket({ home: innings(100), away: innings(90) }), "en", NOW.toISOString(), NOW).withheldReason).toBe("missing_score")
    expect(buildReport(cricket({ outcome: "no-result" }), "en", NOW.toISOString(), NOW).withheldReason).toBe("missing_score")
  })
})

describe("full reports", () => {
  it("gives Plus each sport's own story, in sentences", () => {
    const plus = (item: SportEvent) => buildFullReport(item, detail(), "plus", "en")
    expect(plus(test).summary.join(" ")).toContain("North: 450/10 & 150/10.")
    expect(plus(test).summary).toContain("Player of the match: Dee.")
    expect(plus(tennis).summary).toEqual(["Set 1: Ivo 6-4 Jan.", "Set 2: Ivo 3-6 Jan.", "Set 3: Ivo 7-6(5) Jan."])
    expect(plus(fight).summary[0]).toMatch(/^North beat Other: knockout, Round 2, 1:30\.$/)
    expect(plus(race).summary).toContain("Classification: 1. Ann, 2. Bea.")
    expect(plus(race).summary).toContain("Fastest lap: Bea · 1:12.5.")
    for (const item of [test, tennis, fight, race]) expect(plus(item)).toMatchObject({ state: "ok" })
    expect(buildFullReport(tennis, detail(), "plus", "fr").summary[0]).toContain("Ivo 6-4 Jan.")
    expect(buildFullReport(test, detail(), "plus", "fr").summary).toContain("Joueur du match : Dee.")
  })
  it("reads team sports' period scores, including ones only the timeline proves", () => {
    const quarters = event({ sportId: "basketball", score: { kind: "team", home: 90, away: 80 }, breakdown: { segments: [{ kind: "quarter", number: 1, home: 30, away: 20 }, { kind: "quarter", number: 2, home: 20, away: 25 }, { kind: "quarter", number: 3, home: 20, away: 15 }, { kind: "quarter", number: 4, home: 20, away: 20 }] } })
    expect(buildFullReport(quarters, detail(), "plus", "en").summary[0]).toBe("Score by quarter (North, South): Q1 30-20, Q2 20-25, Q3 20-15, Q4 20-20.")
    const hockey = event({ sportId: "ice-hockey" })
    const proved = detail({ breakdown: { segments: [{ kind: "period", number: 1, home: 2, away: 1 }] } })
    expect(buildFullReport(hockey, proved, "plus", "en").summary[0]).toContain("Period 1 2-1")
  })
  it("has nothing to say when the timeline holds nothing worth reporting, whatever the plan's venue", () => {
    const quiet = detail({ timeline: [{ id: "1", minute: 3, kind: "yellow", side: "home", player: "Y", secondary: null }] })
    expect(buildFullReport(event({ venue: "Park" }), quiet, "plus", "en")).toMatchObject({ state: "empty", moments: [] })
    expect(buildFullReport(event({ sportId: "basketball" }), detail({ stats: [{ key: "rebounds", home: "40", away: "30" }] }), "plus", "en").state).toBe("empty")
  })
  it("gives Premium analysis for every sport with a result, and none without one", () => {
    const premium = (item: SportEvent) => buildFullReport(item, detail(), "premium", "en")
    expect(premium(event()).insights).toEqual(["North won by 1 goal."])
    expect(premium(event({ score: { kind: "team", home: 1, away: 1 } })).insights).toEqual(["The game finished level at 1-1."])
    expect(premium(event({ sportId: "ice-hockey", conclusion: "shootout", score: { kind: "team", home: 3, away: 2 } })).insights).toEqual(["North won, after shootout."])
    expect(premium(event({ sportId: "basketball", conclusion: "overtime", score: { kind: "team", home: 101, away: 100 } })).insights).toEqual(["North won by 1 point (after overtime)."])
    expect(premium(event({ sportId: "baseball", score: { kind: "team", home: 5, away: 2 } })).insights).toEqual(["North won by 3 runs."])
    expect(premium(event({ sportId: "volleyball", score: { kind: "team", home: 3, away: 1 } })).insights).toEqual(["North won the match 3-1 in sets."])
    expect(premium(event({ conclusion: "awarded", score: { kind: "team", home: 3, away: 0 } })).insights).toEqual(["Awarded."])
    expect(premium(tennis).insights).toEqual(["Ivo won the match 2-1 in sets.", "Games won: Ivo 16, Jan 16.", "Sets decided by a tiebreak: 1."])
    expect(premium(test).insights).toEqual(["North won by 100 runs.", "The highest innings was 450, by North."])
    expect(premium(cricket({ home: innings(300), away: innings(250, 3), outcome: "drawn" })).insights).toEqual(["Match drawn."])
    expect(premium(fight).insights).toEqual(["North won, knockout, Round 2 (1:30).", "Of the 3 bouts with a result, 2 ended inside the distance and 1 went to the judges."])
    expect(premium(race).insights).toEqual(["Ann started from pole position and finished first.", "Bea gained the most places, from 6 on the grid to 2.", "Not classified: 1.", "Ann leads the championship on 120 points."])
    expect(premium(event({ status: "live", score: { kind: "none" } }))).toMatchObject({ state: "empty", insights: [] })
  })
  it("states no number the event does not hold", () => {
    for (const item of [tennis, test, fight, race, event({ sportId: "basketball", score: { kind: "team", home: 90, away: 80 } })]) {
      const known = new Set(JSON.stringify(item).match(/\d+/g))
      const told = (buildFullReport(item, detail(), "premium", "en").insights ?? []).join(" ")
      // The two figures an insight works out itself.
      const worked = item.sportId === "basketball" ? ["10"] : item.sportId === "tennis" ? ["16", "2", "1"] : item.sportId === "combat-sports" ? ["3", "2", "1"] : item.sportId === "motorsport" ? ["1"] : []
      expect((told.match(/\d+/g) ?? []).filter((number) => !known.has(number) && !worked.includes(number))).toEqual([])
    }
  })
  it("keeps football's moments and stat lines, and the analysis away from Plus", () => {
    const rich = detail({
      timeline: [goal("1", "home"), { id: "2", minute: 80, kind: "red", side: "away", player: "R", secondary: null }],
      stats: [{ key: "ball possession", home: "60%", away: "40%" }, { key: "expected_goals", home: "1.4", away: "0.3" }, { key: "total shots", home: "12", away: "4" }, { key: "shots on goal", home: "5", away: "1" }],
    })
    const plus = buildFullReport(event(), rich, "plus", "en")
    expect(plus.moments.map((moment) => moment.team)).toEqual(["North", "South"])
    expect(plus.insights).toBeUndefined()
    expect(plus.stats).toBeUndefined()
    expect(buildFullReport(event(), rich, "premium", "en").insights).toEqual(expect.arrayContaining(["North had 60% of the ball.", "North scored 2 from 1.4 expected goals.", "North put 5 of 12 shots on target."]))
    expect(buildFullReport(event(), detail(), "plus", "fr").state).toBe("empty")
  })
})

describe("hockey recaps", () => {
  const hockey = (score: EventScore, extra: Partial<SportEvent> = {}) => event({ sportId: "ice-hockey", score, ...extra })
  const recap = (item: SportEvent, timeline: TimelineItem[]) => buildRecap(item, detail({ timeline }), "en", NOW.toISOString(), NOW)
  it("publishes a timeline that adds up and holds one that does not", () => {
    const score: EventScore = { kind: "team", home: 2, away: 1 }
    expect(recap(hockey(score), [goal("1", "home"), goal("2", "home"), goal("3", "away")])?.status).toBe("validated")
    expect(recap(hockey(score), [goal("1", "home"), goal("3", "away")])).toMatchObject({ status: "draft", withheldReason: "timeline_conflict" })
  })
  it("does not count the goal a shootout adds to the winner's score", () => {
    const score: EventScore = { kind: "team", home: 3, away: 2 }
    const shootout = hockey(score, { conclusion: "shootout" })
    expect(recap(shootout, [goal("1", "home"), goal("2", "home"), goal("3", "away"), goal("4", "away")])?.status).toBe("validated")
    expect(recap(shootout, [goal("1", "home"), goal("2", "away"), goal("3", "home"), goal("4", "away"), goal("5", "home", { period: "PT" })])?.status).toBe("validated")
    expect(recap(shootout, [goal("1", "home"), goal("2", "away")])?.status).toBe("draft")
  })
  it("leaves other sports' recaps unchecked", () => {
    expect(recap(event({ sportId: "rugby" }), [goal("1", "home")])?.status).toBe("validated")
  })
})
