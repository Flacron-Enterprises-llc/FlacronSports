// Basketball rows as the source sent them in the week of 2026-11-07.
import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { basketballClock, basketballDetails } from "@/lib/sports/adapters/basketball"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { calculateTable } from "@/lib/sports/calculated"
import { advancedFigures, basicProfile, type Comparison } from "@/lib/sports/compare"
import { teamSheet } from "@/lib/sports/compare-rows"
import { decidedSide } from "@/lib/sports/game-result"
import { liveClock, livePhase } from "@/lib/sports/presentation"
import { sportChip, sportFacts } from "@/lib/sports/sport-terms"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

const en = getDictionary("en")
const fr = getDictionary("fr")
const now = new Date("2026-11-07T08:40:00Z")
const read = (raw: Partial<RawEvent>) => normalizeEvent({ idEvent: "1", strTimestamp: "2026-11-04T16:00:00", ...raw }, "basketball", now)

// FIBA Europe Cup 2608504. Split won 97-77; the row titles the game "away vs home" and puts the scores in title order.
const BATUMI_SPLIT: Partial<RawEvent> = {
  idEvent: "2608504", strLeague: "FIBA Europe Cup", strEvent: "BC Batumi vs KK Split", strHomeTeam: "KK Split", strAwayTeam: "BC Batumi",
  intHomeScore: "77", intAwayScore: "97", strStatus: "FT", strPostponed: "no",
  strResult: " BC Batumi Quarters:<br>17 16 28 16 <br><br>KK Split Quarters:<br>35 24 17 21 ",
}

describe("basketball rows titled away first", () => {
  it("gives each team its own score and quarters, so the winner is right", () => {
    const game = read(BATUMI_SPLIT)
    expect(game.participants.map((side) => side.name)).toEqual(["KK Split", "BC Batumi"])
    expect(game.score).toEqual({ kind: "team", home: 97, away: 77 })
    expect(decidedSide(game)).toEqual({ winner: 0 })
    expect(game.breakdown?.segments[0]).toEqual({ kind: "quarter", number: 1, home: 35, away: 17 })
  })

  it("reads men's college halves on a reversed row: Grambling State 89, Northern Illinois 87 (2620679)", () => {
    const game = read({ strLeague: "NCAA Division I Basketball Mens", strEvent: "Grambling State vs Northern Illinois", strHomeTeam: "Northern Illinois", strAwayTeam: "Grambling State", intHomeScore: "89", intAwayScore: "87", strStatus: "FT", strResult: " Grambling State Quarters:<br>0 43 0 46 <br><br>Northern Illinois Quarters:<br>0 36 0 51 " })
    expect(game.score).toEqual({ kind: "team", home: 87, away: 89 })
    expect(game.breakdown?.segments.map((item) => [item.kind, item.home, item.away])).toEqual([["half", 36, 43], ["half", 51, 46]])
  })

  it("follows the title in a season row too, which has no quarters: Detroit beat Dallas 122-110 in Mexico City (2292739)", () => {
    const raw = { idEvent: "2292739", idLeague: "4387", strLeague: "NBA", strEvent: "Detroit Pistons vs Dallas Mavericks", strHomeTeam: "Dallas Mavericks", strAwayTeam: "Detroit Pistons", intHomeScore: "122", intAwayScore: "110", strStatus: "FT", dateEvent: "2025-11-02", strTimestamp: "2025-11-02T20:00:00" }
    const game = read(raw)
    expect(basicProfile("Detroit Pistons", [game], []).form).toEqual(["W"])
    const others = [["A", "B"], ["C", "D"], ["A", "C"], ["B", "D"], ["Dallas Mavericks", "A"], ["Detroit Pistons", "B"], ["C", "Dallas Mavericks"], ["D", "Detroit Pistons"]].map(([home, away], index) => ({ idEvent: String(index + 10), idLeague: "4387", strLeague: "NBA", strEvent: `${home} vs ${away}`, strHomeTeam: home, strAwayTeam: away, intHomeScore: "100", intAwayScore: "90", strStatus: "FT", dateEvent: "2025-11-0" + (index % 8 + 1), strTimestamp: "2025-11-01T20:00:00" }))
    const table = calculateTable([raw, ...others], "basketball", "4387", "NBA", now)
    const row = (name: string) => table?.rows.find((item) => item.team === name)
    expect([row("Detroit Pistons")?.won, row("Dallas Mavericks")?.lost]).toEqual([2, 2])
    expect(row("Dallas Mavericks")?.scoredFor).toBe(110 + 100 + 90)
  })

  it("leaves a row titled home first as it is", () => {
    expect(read({ ...BATUMI_SPLIT, strEvent: "KK Split vs BC Batumi", strResult: "" }).score).toEqual({ kind: "team", home: 77, away: 97 })
  })
})

describe("basketball result text", () => {
  it("reads quarters written with commas (Adriatic ABA League 2, 2560982)", () => {
    const game = read({ strEvent: "KK Triglav Kranj vs KK Sloboda Užice", strHomeTeam: "KK Triglav Kranj", strAwayTeam: "KK Sloboda Užice", intHomeScore: "78", intAwayScore: "76", strStatus: "FT", strResult: "KK Triglav Kranj Quarters:<br>20, 27, 16, 15<br><br>KK Sloboda Užice Quarters:<br>20, 15, 17, 24" })
    expect(game.breakdown?.segments.map((item) => item.home)).toEqual([20, 27, 16, 15])
  })

  it("shows overtime as its own column after the four quarters (Memphis 134, New Orleans 135, 2601764)", () => {
    const game = read({ strLeague: "NBA", strEvent: "Memphis Grizzlies vs New Orleans Pelicans", strHomeTeam: "Memphis Grizzlies", strAwayTeam: "New Orleans Pelicans", intHomeScore: "134", intAwayScore: "135", strStatus: "AOT", strResult: " Memphis Grizzlies Quarters:<br>28 34 33 29 10<br><br>New Orleans Pelicans Quarters:<br>34 25 41 24 11" })
    expect(game.conclusion).toBe("overtime")
    expect(lineScore(game, en, "short")?.columns.map((column) => column.label)).toEqual(["Q1", "Q2", "Q3", "Q4", "OT", "T"])
  })

  it("hides quarters a just-finished row has not caught up with (Lakers 124-118, 2601795)", () => {
    expect(read({ strEvent: "Los Angeles Lakers vs Portland Trail Blazers", strHomeTeam: "Los Angeles Lakers", strAwayTeam: "Portland Trail Blazers", intHomeScore: "124", intAwayScore: "118", strStatus: "FT", strResult: "Los Angeles Lakers Quarters:<br>20 33 4  <br><br>Portland Trail Blazers Quarters:<br>29 31 0" }).breakdown).toBeUndefined()
  })
})

describe("basketball live clock", () => {
  const live = (status: string, progress: string | null, league = "Japanese B1 League") => {
    const game = read({ strLeague: league, strStatus: status, strProgress: progress, strTimestamp: "2026-11-07T07:00:00", strHomeTeam: "A", strAwayTeam: "B", intHomeScore: "53", intAwayScore: "71" })
    const phase = livePhase(game, en)
    return [phase, liveClock(game, phase)]
  }

  it("shows the quarter with the minute the feed counts up", () => expect(live("Q2", "5")).toEqual(["Q2", "5′"]))
  it("drops the 0 the feed sends through a break", () => {
    expect(live("BT", "0")).toEqual(["Break", null])
    expect(live("HT", "0")).toEqual(["Half-time", null])
  })
  it("drops the overtime count, which runs 6 to 10 in a five-minute period", () => expect(live("OT", "9", "NBA")).toEqual(["OT", null]))
  it("keeps men's college halves", () => expect(live("Q2", "7", "NCAA Division I Basketball Mens")).toEqual(["2nd half", "7′"]))
  it("accepts no minute past a quarter's length", () => expect(basketballClock("Q4", "13")).toBeNull())
})

describe("basketball status", () => {
  it("calls a game the source cancelled cancelled, even with the postponed flag set (EuroCup 2588467)", () => {
    expect(read({ strStatus: "CANC", strPostponed: "yes", strHomeTeam: "AS Monaco Basket", strAwayTeam: "BC Balkan Botevgrad" }).status).toBe("canceled")
  })
  it("keeps a played game finished when the flag stayed on (NBA 2025-26 has 50 such rows)", () => {
    expect(read({ strStatus: "FT", strPostponed: "yes", intHomeScore: "110", intAwayScore: "100", strHomeTeam: "A", strAwayTeam: "B" }).status).toBe("finished")
  })
  it("still shows a postponement the source has not settled", () => expect(read({ strStatus: "NS", strPostponed: "yes", strTimestamp: "2026-11-10T16:00:00" }).status).toBe("postponed"))
})

describe("basketball event details", () => {
  const facts = (raw: Partial<RawEvent>) => sportFacts({ details: basketballDetails(raw as RawEvent) }, en).map((fact) => `${fact.label}: ${fact.value}`)

  it("names the EuroLeague round and season", () => {
    const game = read({ strLeague: "EuroLeague Basketball", intRound: "10", strSeason: "2026-2027", strCountry: "Spain", strEvent: "Real Madrid Baloncesto vs Panathinaikos BC", strHomeTeam: "Real Madrid Baloncesto", strAwayTeam: "Panathinaikos BC" })
    expect(sportChip(game, en)).toBe("Round 10")
    expect(sportFacts(game, en).map((fact) => fact.label)).toEqual(["Round", "Season", "Location"])
  })

  it("names a Champions League group", () => expect(sportChip({ details: basketballDetails({ idEvent: "1", strLeague: "Basketball Champions League", intRound: "3", strGroup: "E" }) }, en)).toBe("Round 3 · Group E"))

  it("gives the NBA no round, since it numbers weeks", () => expect(basketballDetails({ idEvent: "1", strLeague: "NBA", intRound: "17" }).round).toBeNull())

  it("reads each league's own stage codes", () => {
    const stage = (league: string, round: string) => basketballDetails({ idEvent: "1", strLeague: league, intRound: round }).stage
    expect([stage("NBA", "500"), stage("NBA", "400"), stage("NBA", "160"), stage("NBA", "200")]).toEqual(["preseason", "play-in", "first-round", "final"])
    expect([stage("EuroLeague Basketball", "170"), stage("EuroLeague Basketball", "125"), stage("EuroLeague Basketball", "150")]).toEqual(["play-in", "quarter", "semi"])
    expect(stage("WNBA", "160")).toBe("first-round")
    expect(stage("Turkish Basketbol Super Ligi", "160")).toBeNull()
  })

  it("says so in French", () => expect(sportChip({ details: basketballDetails({ idEvent: "1", strLeague: "NBA", intRound: "500" }) }, fr)).toBe("Présaison"))

  it("leaves out what the row does not give", () => expect(facts({ strLeague: "NBA", intRound: "0", intSpectators: "0" })).toEqual([]))
})

describe("basketball comparison", () => {
  // New Orleans' last ten as the team schedule gave them on 2026-11-07: three overtime games and one preseason game.
  const games = [
    ["2601794", "New Orleans Pelicans", "Minnesota Timberwolves", 109, 115, "FT", "0"],
    ["2601778", "New Orleans Pelicans", "Utah Jazz", 120, 113, "AOT", "0"],
    ["2601764", "Memphis Grizzlies", "New Orleans Pelicans", 134, 135, "AOT", "0"],
    ["2601748", "New Orleans Pelicans", "Atlanta Hawks", 121, 99, "FT", "0"],
    ["2601699", "Denver Nuggets", "New Orleans Pelicans", 141, 135, "AOT", "0"],
    ["2601689", "Utah Jazz", "New Orleans Pelicans", 120, 119, "FT", "0"],
    ["2601661", "New Orleans Pelicans", "Washington Wizards", 107, 106, "FT", "500"],
  ].map(([id, home, away, homeScore, awayScore, status, round]) => read({ idEvent: id as string, strLeague: "NBA", strEvent: `${home} vs ${away}`, strHomeTeam: home as string, strAwayTeam: away as string, intHomeScore: String(homeScore), intAwayScore: String(awayScore), strStatus: status as string, intRound: round as string }))

  it("counts games beyond regulation from the source's overtime mark", () => expect(advancedFigures("New Orleans Pelicans", games).overtimeGames).toBe(3))

  it("leaves preseason out of the record", () => {
    expect(basicProfile("New Orleans Pelicans", games, []).record).toMatchObject({ played: 6, wins: 3, losses: 3 })
  })

  it("shows the row in the comparison", () => {
    const profile = { ...basicProfile("New Orleans Pelicans", games, []), advanced: { ...advancedFigures("New Orleans Pelicans", games), standing: null } }
    const data: Comparison = { tier: "advanced", sportId: "basketball", teams: [profile, { ...profile, name: "B" }], headToHead: [], fetchedAt: "" }
    expect(teamSheet(data, en).rows.find(([label]) => label === en.compare.overtimeGames)?.[1]).toBe("3")
  })
})
