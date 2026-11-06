import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { americanFootballBreakdown, americanFootballConclusion } from "@/lib/sports/adapters/american-football"
import { baseballBreakdown } from "@/lib/sports/adapters/baseball"
import { basketballBreakdown, basketballRole } from "@/lib/sports/adapters/basketball"
import { hockeyPeriods } from "@/lib/sports/adapters/ice-hockey"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { rugbyBreakdown, rugbyTries } from "@/lib/sports/adapters/rugby"
import { volleyballBreakdown } from "@/lib/sports/adapters/volleyball"
import { labelStats, labelTimeline, normalizeLineups, normalizeStats, normalizeTimeline } from "@/lib/sports/detail"
import { clockText, livePhase } from "@/lib/sports/presentation"
import { currentPeriod, normalizeEvent, normalizeStatus, type RawEvent } from "@/lib/sports/thesportsdb"
import type { EventScore, SportEvent, SportId } from "@/lib/sports/types"

const sides = (home: string, away: string, homeScore: number, awayScore: number) => ({ home, away, homeScore, awayScore })
const team = (home: number, away: number): EventScore => ({ kind: "team", home, away })
const en = getDictionary("en")
const fr = getDictionary("fr")

const event = (sportId: SportId, raw: Partial<RawEvent>) =>
  normalizeEvent({ idEvent: "1", strHomeTeam: "A", strAwayTeam: "B", strStatus: "FT", strTimestamp: "2026-11-05T20:00:00", ...raw }, sportId, new Date("2026-11-06T12:00:00Z"))

describe("basketball", () => {
  it("reads four quarters", () => {
    const text = " Cairns Taipans Quarters:<br>35 27 20 13 <br><br>Illawarra Hawks Quarters:<br>32 29 26 20 "
    expect(basketballBreakdown(text, sides("Cairns Taipans", "Illawarra Hawks", 95, 107))?.segments.map((item) => item.kind)).toEqual(["quarter", "quarter", "quarter", "quarter"])
  })
  it("numbers every overtime", () => {
    const text = " A Quarters:<br>20 20 20 20 10 9<br><br>B Quarters:<br>20 20 20 20 10 5"
    const segments = basketballBreakdown(text, sides("A", "B", 99, 95))?.segments ?? []
    expect(segments.slice(4)).toEqual([{ kind: "overtime", number: 1, home: 10, away: 10 }, { kind: "overtime", number: 2, home: 9, away: 5 }])
  })
  it("reads men's college halves and their overtime", () => {
    const text = " Arizona Quarters:<br>0 59 0 45 6<br><br>Cal Poly Quarters:<br>0 41 0 43 3"
    expect(basketballBreakdown(text, sides("Arizona", "Cal Poly", 110, 87))?.segments.map((item) => item.kind)).toEqual(["half", "half", "overtime"])
  })
  it("keeps sides right when the text lists the away side first", () => {
    const text = " SK Slavia Prague ERA NBK Quarters:<br>36 27 32 19 <br><br>BK Lokomotiva Plzen Quarters:<br>14 26 16 26 "
    expect(basketballBreakdown(text, sides("BK Lokomotiva Plzen", "SK Slavia Prague ERA NBK", 82, 114))?.segments[0]).toEqual({ kind: "quarter", number: 1, home: 14, away: 36 })
  })
  it("reads a side spelled differently from the event", () => {
    const text = " Levallois Metropolitans BC Quarters:<br>12 19 26 14 <br><br>Fos Provence Basket Quarters:<br>22 17 14 8 "
    expect(basketballBreakdown(text, sides("Levallois Metropolitans BC", "Fos-sur-Mer", 71, 61))?.segments).toHaveLength(4)
  })
  it.each([
    ["a blank shell", "Fenerbahce Quarters:<br>    <br><br>Baskonia Quarters:<br>", 80, 70],
    ["a stale partial row", " London Lions Quarters:<br>22 5   <br><br>Leicester Riders Quarters:<br>20 7   ", 76, 97],
    ["padding zeros on a stopped feed", " Celta Quarters:<br>13 0 0 0 <br><br>Araski Quarters:<br>5 0 0 0 ", 75, 54],
  ])("hides %s", (_, text, home, away) => {
    expect(basketballBreakdown(text as string, sides("A", "B", home as number, away as number))).toBeNull()
  })
  it("shows shooting as percentages and names them in French", () => {
    const rows = normalizeStats([{ strStat: "3-points %", intHome: "38", intAway: "33" }, { strStat: "Rebounds", intHome: "40", intAway: "38" }], "basketball")
    expect(rows[0].home).toBe("38%")
    expect(labelStats(rows, fr.match.stats, "fr").map((row) => row.label)).toEqual(["Réussite à 3 points", "Rebonds"])
  })
  it("keeps the five positions instead of football's groups", () => {
    const { home } = normalizeLineups([{ strPlayer: "X", strHome: "Yes", strPosition: "Point Guard" }, { strPlayer: "Y", strHome: "Yes", strPosition: "Center" }], "basketball")
    expect(home.map((player) => [player.role, player.group])).toEqual([["PG", null], ["C", null]])
    expect(basketballRole("Unknown")).toBeNull()
  })
})

describe("ice hockey", () => {
  const goal = (strPeriod: string, strHome: string) => ({ strTimeline: "Goal", strPeriod, strHome })
  const regulation = [goal("P1", "Yes"), goal("P1", "No"), goal("P3", "Yes")]

  it("counts goals by period when they reach the score, and a goalless period is a real zero", () => {
    expect(hockeyPeriods(regulation, team(2, 1))?.segments).toEqual([
      { kind: "period", number: 1, home: 1, away: 1 },
      { kind: "period", number: 2, home: 0, away: 0 },
      { kind: "period", number: 3, home: 1, away: 0 },
    ])
  })
  it("adds overtime only when it was played", () => {
    expect(hockeyPeriods([...regulation, goal("POT", "No")], team(2, 2))?.segments.at(-1)).toEqual({ kind: "overtime", number: 1, home: 0, away: 1 })
  })
  it("stands a shootout win on level goals with a scoreless overtime", () => {
    const rows = [goal("P3", "Yes"), goal("P3", "No")]
    const parsed = hockeyPeriods(rows, team(2, 1), "shootout")
    expect(parsed?.segments.map((item) => item.kind)).toEqual(["period", "period", "period", "overtime"])
    expect(parsed?.segments.at(-1)).toMatchObject({ home: 0, away: 0 })
  })
  it("shows no periods when a goal is missing or the timeline is empty", () => {
    expect(hockeyPeriods(regulation, team(5, 1))).toBeNull()
    expect(hockeyPeriods([], team(0, 0))).toBeNull()
  })
  it("orders the timeline by period first, since minutes restart", () => {
    const items = normalizeTimeline([
      { idTimeline: "1", strTimeline: "Goal", strPeriod: "P2", intTime: "3" },
      { idTimeline: "2", strTimeline: "Goal", strPeriod: "POT", intTime: "1" },
      { idTimeline: "3", strTimeline: "Penalty", strTimelineDetail: "Tripping", strPeriod: "P1", intTime: "18" },
    ], "ice-hockey")
    expect(items.map((item) => item.period)).toEqual(["P1", "P2", "POT"])
  })
  it("words penalties and goal situations in French", () => {
    const items = normalizeTimeline([
      { strTimeline: "Penalty", strTimelineDetail: "Cross-checking", strPeriod: "P1", intTime: "2" },
      { strTimeline: "Goal", strTimelineDetail: "Power-play", strPeriod: "P1", intTime: "3", strPlayer: "X" },
      { strTimeline: "Penalty", strTimelineDetail: "Some new wording", strPeriod: "P1", intTime: "4" },
    ], "ice-hockey")
    const words = { infractions: fr.match.infractions, situations: fr.match.goalSituations }
    expect(labelTimeline(items, fr.match.timelineKinds, "fr", words).map((item) => item.label)).toEqual(["Pénalité: Double-échec", "But · En avantage numérique", "Pénalité"])
  })
  it("names a shootout on a finished game", () => {
    expect(event("ice-hockey", { strStatus: "AP", intHomeScore: "2", intAwayScore: "1" }).conclusion).toBe("shootout")
  })
})

describe("American football", () => {
  it("reads headed quarters", () => {
    const text = " Eastern Michigan Quarter 1:<br>0 7 <br>Quarter 2<br>0 14 <br>Quarter 3<br>0 7 <br>Quarter 4<br>7 7 <br>Overtime<br> "
    expect(americanFootballBreakdown(text, sides("Eastern Michigan", "X", 7, 35))?.segments).toHaveLength(4)
  })
  it("adds overtime", () => {
    const text = " UMass Quarter 1:<br>0 7 <br>Quarter 2<br>14 3 <br>Quarter 3<br>7 7 <br>Quarter 4<br>3 7 <br>Overtime<br>7 6"
    expect(americanFootballBreakdown(text, sides("UMass", "Ball State", 31, 30))?.segments.at(-1)).toEqual({ kind: "overtime", number: 1, home: 7, away: 6 })
  })
  it("reads named quarters whichever side comes first", () => {
    const text = "Score by Quarters\r\nQ1: Paris Musketeers 10 - Raiders Tirol 0\r\nQ2: Paris Musketeers 6 - Raiders Tirol 6\r\nQ3: Paris Musketeers 7 - Raiders Tirol 6\r\nQ4: Paris Musketeers 10 - Raiders Tirol 0\r\nTotal: Paris Musketeers  33 - Raiders Tirol 12\r\n\r\nQtr Time Team Scoring Play V-H\r\n1st 08:32 PM - Hugo Tekedam 38 yd pass, 9-71 6:28, 7 - 0"
    const parsed = americanFootballBreakdown(text, sides("Raiders Tirol", "Paris Musketeers", 12, 33))
    expect(parsed?.segments[0]).toEqual({ kind: "quarter", number: 1, home: 0, away: 10 })
    expect(parsed?.segments).toHaveLength(4)
  })
  it("hides a blank shell", () => {
    const text = " Atlanta Falcons Quarter 1:<br>  <br>Quarter 2<br>  <br>Quarter 3<br>  <br>Quarter 4<br>  <br>Overtime<br> "
    expect(americanFootballBreakdown(text, sides("Atlanta Falcons", "X", 20, 10))).toBeNull()
  })
  it("reads overtime from a plain final line, which has no quarters", () => {
    expect(americanFootballConclusion("Final - 2OT")).toBe("overtime")
    expect(americanFootballConclusion("Final")).toBeNull()
    const finished = event("american-football", { strResult: "Final - 2OT", intHomeScore: "32", intAwayScore: "29" })
    expect(finished.conclusion).toBe("overtime")
    expect(finished.breakdown).toBeUndefined()
  })
})

describe("baseball", () => {
  it("reads innings, hits and errors", () => {
    const text = " Charros de Jalisco Innings:<br>2 0 1 0 1 1 0 0 0 <br>Hits: 9 - Errors: 0<br><br>Algodoneros de Guasave Innings:<br>2 0 1 0 2 2 0 2 1 <br>Hits: 15 - Errors: 0"
    const parsed = baseballBreakdown(text, sides("Charros de Jalisco", "Algodoneros de Guasave", 5, 10))
    expect(parsed?.segments).toHaveLength(9)
    expect(parsed?.hits).toEqual({ home: 9, away: 15 })
    expect(parsed?.errors).toEqual({ home: 0, away: 0 })
  })
  it("leaves the home side's unplayed ninth empty and marks it X in the line score", () => {
    const strResult = " A Innings:<br>0 0 0 0 4 0 0 0 <br>Hits: 7 - Errors: 0<br><br>B Innings:<br>0 0 0 0 0 0 0 0 1 <br>Hits: 5 - Errors: 1"
    const finished = event("baseball", { strResult, intHomeScore: "4", intAwayScore: "1" })
    expect(finished.breakdown?.segments[8]).toEqual({ kind: "inning", number: 9, home: null, away: 1 })
    const table = lineScore(finished, en)
    expect(table?.rows.map((row) => row.side)).toEqual(["away", "home"])
    expect(table?.columns.map((column) => column.label)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "R", "H", "E"])
    expect(table?.rows[1].cells[8].value).toBe("X")
  })
  it("works out extras, because the feed writes one side's number for both", () => {
    const text = " Yaquis de Obregon Innings:<br>1 1 1 0 0 0 2 0 0 2<br>Hits: 12 - Errors: 0<br><br>Mayos de Navojoa Innings:<br>0 1 0 1 0 3 0 0 0 2<br>Hits: 11 - Errors: 2"
    const parsed = baseballBreakdown(text, sides("Yaquis de Obregon", "Mayos de Navojoa", 8, 7))
    expect(parsed?.segments.at(-1)).toEqual({ kind: "extras", number: 1, home: 3, away: 2 })
    expect(parsed?.segments).toHaveLength(10)
  })
  it("refuses extras when neither side's total explains the slot", () => {
    const text = " A Innings:<br>1 0 0 0 0 0 0 0 0 7<br><br>B Innings:<br>1 0 0 0 0 0 0 0 0 7"
    expect(baseballBreakdown(text, sides("A", "B", 3, 2))).toBeNull()
  })
  it("reads the tabbed table", () => {
    const text = "1 \t2 \t3 \t4 \t5 \t6 \t7 \t8 \t9 \tR \tH \tE\r\nVenezuela \t0 \t0 \t1 \t0 \t1 \t0 \t0 \t0 \t1 \t3 \t6 \t0\r\nUnited States \t0 \t0 \t0 \t0 \t0 \t0 \t0 \t2 \t0 \t2 \t3 \t0"
    const parsed = baseballBreakdown(text, sides("USA Baseball", "Venezuela Baseball", 2, 3))
    expect(parsed?.hits).toEqual({ home: 3, away: 6 })
    expect(parsed?.segments[7]).toEqual({ kind: "inning", number: 8, home: 2, away: 0 })
  })
  it("keeps innings when hits and errors are blank", () => {
    const text = " A Innings:<br>0 2 6 0 0 3 <br>Hits:  - Errors: <br><br>B Innings:<br>0 0 0 0 0 0 0 <br>Hits:  - Errors: "
    const parsed = baseballBreakdown(text, sides("A", "B", 11, 0))
    expect(parsed?.segments).toHaveLength(7)
    expect(parsed?.hits).toBeUndefined()
  })
  it("hides a pregame shell, even one that says zero hits", () => {
    const text = " Leones Innings:<br>         <br>Hits: 0 - Errors: 0<br><br>Bravos Innings:<br>         <br>Hits: 0 - Errors: 0"
    expect(baseballBreakdown(text, sides("Leones", "Bravos", 3, 2))).toBeNull()
  })
})

describe("rugby", () => {
  const halves = " Wales Rugby First Half:<br>21 0 <br>Second Half<br>10 17 <br>Overtime<br>"

  it("reads halves and leaves out an empty overtime", () => {
    expect(rugbyBreakdown(halves, sides("Wales Rugby", "Italy Rugby", 31, 17), null)?.segments.map((item) => item.kind)).toEqual(["half", "half"])
  })
  it("reads a text opening with the away side", () => {
    const parsed = rugbyBreakdown(" Italy Rugby First Half:<br>0 21 <br>Second Half<br>17 10 <br>Overtime<br>", sides("Wales Rugby", "Italy Rugby", 31, 17), null)
    expect(parsed?.segments[0]).toEqual({ kind: "half", number: 1, home: 21, away: 0 })
  })
  it("gives tries from the extra score field, alongside or without halves", () => {
    const finished = event("rugby", { strResult: halves, strHomeTeam: "Wales Rugby", strAwayTeam: "Italy Rugby", intHomeScore: "31", intAwayScore: "17", intHomeScoreExtra: "4", intAwayScoreExtra: "3" })
    expect(finished.breakdown?.tries).toEqual({ home: 4, away: 3 })
    expect(lineScore(finished, fr)?.columns.at(-1)?.label).toBe("Essais")
    const blank = " X First Half:<br>  <br>Second Half<br>  <br>Overtime<br> "
    const triesOnly = event("rugby", { strResult: blank, intHomeScore: "31", intAwayScore: "17", intHomeScoreExtra: "4", intAwayScoreExtra: "3" })
    expect(triesOnly.breakdown).toEqual({ segments: [], tries: { home: 4, away: 3 } })
    expect(lineScore(triesOnly, en)?.rows[0].cells.map((cell) => cell.value)).toEqual([31, 4])
  })
  it("refuses a count that cannot be tries at those scores", () => {
    expect(rugbyTries(9, 1, sides("A", "B", 20, 10))).toBeNull()
  })
  it("gives no breakdown when halves are blank and no tries are stated", () => {
    expect(event("rugby", { strResult: " A First Half:<br>  <br>Second Half<br>  <br>Overtime<br> ", intHomeScore: "52", intAwayScore: "17" }).breakdown).toBeUndefined()
  })
})

describe("volleyball", () => {
  it("reads a three set game through the source's trailing whitespace", () => {
    const text = " Lokomotiv Novosibirsk First:<br>25 19 <br>Second<br>25 21 <br>Third<br>25 23 <br>Forth<br><br>Fifth<br> \r\n\t\t\t\t\t\t\t\t\t"
    expect(volleyballBreakdown(text, sides("Lokomotiv Novosibirsk", "X", 3, 0))?.segments).toHaveLength(3)
  })
  it("keeps the fourth set the feed never fills empty, never zero", () => {
    const text = " Projekt Warsaw First:<br>20 25 <br>Second<br>25 20 <br>Third<br>25 21 <br>Forth<br><br>Fifth<br>15 7\r\n\t\t\t\t\t\t\t\t\t"
    const segments = volleyballBreakdown(text, sides("Projekt Warsaw", "X", 3, 2))?.segments ?? []
    expect(segments[3]).toEqual({ kind: "set", number: 4, home: null, away: null })
    expect(segments[4]).toEqual({ kind: "set", number: 5, home: 15, away: 7 })
  })
  it("reads a text opening with the away side", () => {
    const text = " Aluron CMC Warta Zawiercie First:<br>25 22 <br>Second<br>25 18 <br>Third<br>26 24 <br>Forth<br><br>Fifth<br> \n\t\t"
    expect(volleyballBreakdown(text, sides("X", "Aluron CMC Warta Zawiercie", 0, 3))?.segments[0]).toEqual({ kind: "set", number: 1, home: 22, away: 25 })
  })
  it("hides a blank shell", () => {
    expect(volleyballBreakdown(" A First:<br>  <br>Second<br>  <br>Third<br>  <br>Forth<br><br>Fifth<br> ", sides("A", "B", 3, 0))).toBeNull()
  })
})

describe("live states", () => {
  const live = (sportId: SportId, strStatus: string, competition = "League") => ({ sportId, status: "live", providerStatus: strStatus, competition: { id: null, name: competition, country: null } }) as Pick<SportEvent, "status" | "sportId" | "providerStatus" | "competition">

  it.each([
    ["basketball", "Q2", "Q2", "QT2"],
    ["basketball", "OT", "OT", "Prol."],
    ["ice-hockey", "P3", "P3", "P3"],
    ["ice-hockey", "PT", "Shootout", "Tirs au but"],
    ["american-football", "Q4", "Q4", "QT4"],
    ["baseball", "IN7", "Inning 7", "Manche 7"],
    ["rugby", "2H", "2nd half", "2e mi-temps"],
    ["volleyball", "S3", "Set 3", "Set 3"],
  ])("%s %s reads in the sport's own words", (sport, code, english, french) => {
    expect(livePhase(live(sport as SportId, code), en)).toBe(english)
    expect(livePhase(live(sport as SportId, code), fr)).toBe(french)
  })
  it("treats men's college Q1 and Q2 as the two halves, and women's as quarters", () => {
    expect(currentPeriod("Q2", "basketball", "NCAA Division I Basketball Mens")).toEqual({ key: "second-half" })
    expect(currentPeriod("Q2", "basketball", "NCAA Division I Basketball Womens")).toEqual({ key: "quarter", number: 2 })
  })
  it("leaves football's status wording alone", () => {
    expect(livePhase(live("football", "2H"), en)).toBeNull()
    expect(currentPeriod("2H")).toEqual({ key: "second-half" })
  })
  it("reads volleyball sets, shootouts, awarded and interrupted games", () => {
    expect(normalizeStatus({ idEvent: "1", strStatus: "S4" })).toBe("live")
    expect(normalizeStatus({ idEvent: "1", strStatus: "PT" })).toBe("live")
    expect(normalizeStatus({ idEvent: "1", strStatus: "AW" })).toBe("finished")
    expect(normalizeStatus({ idEvent: "1", strStatus: "INTR" })).toBe("interrupted")
  })
  it("shows a bare number as minutes and any other clock as written", () => {
    expect(clockText("9")).toBe("9′")
    expect(clockText("10:23")).toBe("10:23")
  })
  it("keeps every sport's segment label in both languages", () => {
    for (const dictionary of [en, fr]) {
      for (const kind of ["quarter", "half", "period", "inning", "extras", "set", "overtime", "shootout"] as const) {
        expect(dictionary.match.segments[kind]).toBeTruthy()
        expect(dictionary.match.segmentsShort[kind]).toBeTruthy()
      }
    }
  })
})
