import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { advancedFigures, basicProfile, entrantProfile, headToHead, resultLine, teamGames, type Comparison } from "@/lib/sports/compare"
import { teamSheet } from "@/lib/sports/compare-rows"
import { nextDates } from "@/lib/sports/collect"
import { formByGame } from "@/lib/sports/detail"
import { decidedSide } from "@/lib/sports/game-result"
import { filterScores, kindOf, kindOptions } from "@/lib/sports/score-filters"
import { chooseTeam, ongoingMatches } from "@/lib/sports/service"
import type { RawEvent } from "@/lib/sports/thesportsdb"
import type { EventScore, SportDetails, SportEvent, SportId } from "@/lib/sports/types"

const en = getDictionary("en")

const game = (id: string, sportId: SportId, home: string, away: string, score: EventScore, extra: Partial<SportEvent> = {}): SportEvent => ({
  id,
  sportId,
  eventType: "match",
  participantType: "team",
  participants: [{ id: null, name: home, role: "home", badgeUrl: null }, { id: null, name: away, role: "away", badgeUrl: null }],
  competition: { id: "1", name: "League", country: null },
  scheduledStartUTC: `2026-11-0${id}T12:00:00.000Z`,
  status: "finished",
  providerStatus: "FT",
  score,
  ...extra,
} as unknown as SportEvent)

const cricket = (format: "test" | "odi" | "t20"): SportDetails => ({ kind: "cricket", format, scheduledDays: null, stage: null, matchLabel: null, round: null, season: null, group: null, phase: null, umpires: null, dayNight: false, city: null, country: null, women: false, toss: null, spectators: null })
const innings = (runs: number, wickets: number | null = null) => ({ runs, wickets, overs: null })
const inn = (home: number, away: number, rest: object = {}): EventScore => ({ kind: "innings", home: innings(home), away: innings(away), winner: null, margin: null, ...rest })

describe("team lookup holds to the chosen sport", () => {
  const teams = [
    { idTeam: "1", strTeam: "India", strSport: "Soccer" },
    { idTeam: "2", strTeam: "India Cricket", strSport: "Cricket" },
    { idTeam: "3", strTeam: "India Cricket Women", strSport: "Cricket" },
  ]
  it("answers cricket with the cricket side", () => expect(chooseTeam(teams, "India", "cricket")?.id).toBe("2"))
  it("keeps the women's side apart", () => expect(chooseTeam(teams, "India Women", "cricket")?.id).toBe("3"))
  it("never crosses into another sport", () => expect(chooseTeam([teams[0]], "India", "cricket")).toBeNull())
  it("still works with no sport named", () => expect(chooseTeam(teams, "India")?.id).toBe("1"))
})

describe("who won, by each sport's score", () => {
  it("reads a one-day game by the higher total only for a calculated table", () => {
    const event = game("1", "cricket", "A", "B", inn(280, 240), { details: cricket("odi") })
    expect(decidedSide(event, { guessCricket: true })).toEqual({ winner: 0 })
    expect(decidedSide(event)).toBeNull()
  })
  it("does not read a Test by totals", () => expect(decidedSide(game("1", "cricket", "A", "B", inn(500, 300), { details: cricket("test") }))).toBeNull())
  it("treats a stated draw as a draw", () => expect(decidedSide(game("1", "cricket", "A", "B", inn(300, 300, { outcome: "drawn" }), { details: cricket("test") }))).toEqual({ winner: null }))
  it("ignores a 0-0 nobody entered in basketball", () => expect(decidedSide(game("1", "basketball", "A", "B", { kind: "team", home: 0, away: 0 }))).toBeNull())
  it("keeps a real football 0-0", () => expect(decidedSide(game("1", "football", "A", "B", { kind: "team", home: 0, away: 0 }))).toEqual({ winner: null }))
  it("gives a shootout to the side that won it", () => expect(decidedSide(game("1", "football", "A", "B", { kind: "team", home: 1, away: 1 }, { conclusion: "penalties", shootout: { home: 3, away: 4 } }))).toEqual({ winner: 1 }))
  it("rejects a volleyball score that cannot be sets", () => expect(decidedSide(game("1", "volleyball", "A", "B", { kind: "team", home: 25, away: 20 }))).toBeNull())
})

describe("comparison reads each sport", () => {
  const events = [
    game("1", "cricket", "India Cricket", "Pakistan Cricket", inn(310, 250), { details: cricket("odi") }),
    game("2", "cricket", "Pakistan Cricket", "India Cricket", inn(160, 180, { outcome: "won", winner: "India Cricket", margin: { value: 5, unit: "wickets" } }), { details: cricket("t20") }),
    game("3", "cricket", "India Cricket", "Australia Cricket", inn(400, 400, { outcome: "drawn" }), { details: cricket("test") }),
    game("4", "cricket", "India Cricket", "Sri Lanka Cricket", inn(200, 200, { outcome: "tied" }), { details: cricket("odi") }),
    game("5", "cricket", "India Cricket", "Sri Lanka Cricket", { kind: "innings", home: null, away: null, winner: null, margin: null, outcome: "no-result" }, { details: cricket("odi") }),
  ]

  it("counts cricket's own results", () => {
    const { record } = basicProfile("India Cricket", events, [])
    expect(record).toMatchObject({ played: 4, wins: 1, draws: 1, ties: 1, noResults: 1 })
  })

  it("breaks a record down by format", () => {
    const figures = advancedFigures("India Cricket", events)
    expect(figures.cricket?.byFormat.t20).toMatchObject({ wins: 1, played: 1 })
    expect(figures.cricket?.highest).toBe(400)
    expect(figures.cricket?.winsByWickets).toBe(1)
  })

  it("uses cricket's words and no football rows", () => {
    const team = { ...basicProfile("India Cricket", events, []), advanced: { ...advancedFigures("India Cricket", events), standing: null } }
    const data: Comparison = { tier: "advanced", sportId: "cricket", teams: [team, { ...team, name: "Pakistan Cricket" }], headToHead: [], fetchedAt: "" }
    const labels = teamSheet(data, en).rows.map(([label]) => label)
    expect(labels).toContain(en.compare.bySport.cricket.record)
    expect(labels).toContain(en.compare.bySport.cricket.scored)
    expect(labels).toContain("T20 record")
    expect(labels.join(" ")).not.toMatch(/Clean sheets|Goal|Won-drawn-lost/)
  })

  it("gives basketball a two-part record", () => {
    const games = [game("1", "basketball", "A", "B", { kind: "team", home: 100, away: 90 })]
    const team = basicProfile("A", games, [])
    const data: Comparison = { tier: "basic", sportId: "basketball", teams: [team, { ...team, name: "B" }], headToHead: [], fetchedAt: "" }
    expect(teamSheet(data, en).rows.find(([label]) => label === en.compare.bySport.basketball.record)?.[1]).toBe("1-0")
  })

  it("reads head to head results in the sport's own form", () => {
    expect(headToHead("India Cricket", "Pakistan Cricket", events)[0].result).toBe("India Cricket 310, Pakistan Cricket 250")
    expect(resultLine(game("1", "tennis", "A", "B", { kind: "sets", lines: [{ name: "A", games: [6, 7] }, { name: "B", games: [4, 6] }], winner: "A", retired: null }))).toBe("6-4 7-6")
  })

  it("counts a retirement in tennis", () => {
    const match = game("1", "tennis", "A", "B", { kind: "sets", lines: [{ name: "A", games: [6, 2] }, { name: "B", games: [3, 1] }], winner: null, retired: "B" })
    expect(teamGames("A", [match])[0].result).toBe("W")
  })

  it("reads a fighter's wins by method from a card", () => {
    const bout = { names: ["A", "B"], winner: "A", method: "ko", round: 1, time: null, weightClass: null, scheduledRounds: null, section: null, scorecards: null }
    const card = game("1", "combat-sports", "Card", "", { kind: "none" }, { participants: [], details: { kind: "combat", discipline: "mma", card: null, bouts: [bout], weightClass: null, scheduledRounds: null, title: null, city: null, country: null, season: null, spectators: null } as SportDetails })
    const profile = entrantProfile("A", "combat-sports", [card])
    expect(profile.record).toMatchObject({ played: 1, wins: 1 })
    expect(profile.combat?.ko).toBe(1)
  })

  it("reads a driver's races from the classification", () => {
    const details = { kind: "motorsport", session: "race" } as SportDetails
    const score: EventScore = { kind: "classification", entries: [{ position: 1, name: "D", team: null, time: null, points: 25 }], out: [{ name: "E", team: null, status: "RET", note: null }] }
    const race = game("1", "motorsport", "GP", "", score, { participants: [], details })
    expect(entrantProfile("D", "motorsport", [race]).racing).toMatchObject({ races: 1, wins: 1, podiums: 1, best: 1, points: 25 })
    expect(entrantProfile("E", "motorsport", [race]).racing).toMatchObject({ races: 1, retirements: 1 })
  })
})

describe("form", () => {
  it("shows a drawn Test", () => expect(formByGame([game("1", "cricket", "A", "B", inn(300, 300, { outcome: "drawn" }), { details: cricket("test") })], "A").map((item) => item.result)).toEqual(["draw"]))
  it("skips an unentered 0-0 in baseball", () => expect(formByGame([game("1", "baseball", "A", "B", { kind: "team", home: 0, away: 0 })], "A")).toEqual([]))
})

describe("each sport's own filter", () => {
  const withDetails = (details: SportDetails) => ({ details })
  it("always offers every cricket format", () => {
    const options = kindOptions("cricket", [withDetails(cricket("odi"))])
    expect(options.map((option) => option.key)).toEqual(["test", "odi", "t20", "first-class", "hundred"])
    expect(options.find((option) => option.key === "odi")?.count).toBe(1)
    expect(options.find((option) => option.key === "t20")?.count).toBe(0)
  })
  it("groups race weekend sessions", () => expect(kindOf(withDetails({ kind: "motorsport", session: "sprint-qualifying" } as SportDetails))).toBe("qualifying"))
  it("offers nothing for football", () => expect(kindOptions("football", [{ details: undefined }])).toEqual([]))
  it("filters to one format", () => {
    const events = [game("1", "cricket", "A", "B", inn(1, 1), { details: cricket("odi") }), game("2", "cricket", "C", "D", inn(1, 1), { details: cricket("t20") })]
    expect(filterScores(events, { q: "", following: null, kind: "t20" }).map((event) => event.id)).toEqual(["2"])
  })
  it("finds a format's next dates through its league", () => {
    const index = { a: "2026-11-09|1", b: "2026-11-10|2", c: "2026-11-11|2" }
    expect(nextDates(index, "2026-11-07", 5, (league) => league === "2").map((item) => item.date)).toEqual(["2026-11-10", "2026-11-11"])
  })
})

describe("multi-day cricket", () => {
  const raw = (over: Partial<RawEvent>): RawEvent => ({ idEvent: "1", strLeague: "ICC World Test Championship", ...over }) as RawEvent
  it("keeps an unfinished Test on its later days", () => expect(ongoingMatches([raw({})], 2)).toHaveLength(1))
  it("drops it after its last day", () => expect(ongoingMatches([raw({})], 5)).toHaveLength(0))
  it("drops a Test with a result", () => expect(ongoingMatches([raw({ strResult: "India won" } as Partial<RawEvent>)], 2)).toHaveLength(0))
  it("leaves one-day games on their day", () => expect(ongoingMatches([raw({ strLeague: "One Day International Series" })], 1)).toHaveLength(0))
})
