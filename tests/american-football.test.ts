import { describe, expect, it } from "vitest"
import { americanFootballDetails, americanFootballRow } from "@/lib/sports/adapters/american-football"
import { recordFor, teamSheet } from "@/lib/sports/compare-rows"
import type { Comparison } from "@/lib/sports/compare"
import { decidedSide } from "@/lib/sports/game-result"
import { getDictionary } from "@/lib/i18n"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { sportChip, sportFacts } from "@/lib/sports/sport-terms"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

const en = getDictionary("en")
const fr = getDictionary("fr")
const NOW = new Date("2026-11-07T09:00:00Z")

// Real rows, trimmed to the fields that matter.
const bengals: RawEvent = {
  idEvent: "2475483", idLeague: "4391", strLeague: "NFL", strSeason: "2026", intRound: "8", strStatus: "FT", strPostponed: "no",
  strEvent: "Cincinnati Bengals vs Tennessee Titans", strFilename: "NFL 2026-11-01 Cincinnati Bengals vs Tennessee Titans",
  strHomeTeam: "Cincinnati Bengals", strAwayTeam: "Tennessee Titans", intHomeScore: "43", intAwayScore: "36", strTimestamp: "2026-11-01T18:00:00",
  strCity: "Cincinnati, OH", strCountry: "United States",
  strResult: " Cincinnati Bengals Quarter 1:<br>0 13 <br>Quarter 2<br>14 0 <br>Quarter 3<br>9 8 <br>Quarter 4<br>13 15 <br>Overtime<br>7 0",
}
const southern: RawEvent = {
  idEvent: "2593834", idLeague: "4479", strLeague: "NCAA Division 1 Football", strSeason: "2026", intRound: "1", strStatus: "FT", strPostponed: "no",
  strEvent: "Southern vs Alabama State", strFilename: "NCAA Division 1 Football 2026-08-29 Southern vs Alabama State",
  strHomeTeam: "Alabama State", strAwayTeam: "Southern", intHomeScore: "17", intAwayScore: "30", strTimestamp: "2026-08-29T19:00:00",
}
const lsu: RawEvent = {
  idEvent: "2294830", idLeague: "4479", strLeague: "NCAA Division 1", strSeason: "2025", intRound: "11", strStatus: "FT", strPostponed: "no",
  strEvent: "LSU vs Alabama", strFilename: "NCAA Division 1 Football 2025-11-09 Alabama vs LSU",
  strHomeTeam: "Alabama", strAwayTeam: "LSU", intHomeScore: "20", intAwayScore: "9", strTimestamp: "2025-11-09T00:30:00",
}

describe("American football rows", () => {
  it("puts the scores back on the right sides when a row is titled and filed away first", () => {
    // Alabama State won 30-17 in Birmingham on 29 August 2026.
    const event = normalizeEvent(southern, "american-football", NOW)
    expect(event.score).toEqual({ kind: "team", home: 30, away: 17 })
    expect(decidedSide(event)?.winner).toBe(0)
  })

  it("keeps team order when the file name reads home first, as Alabama's 20-9 over LSU does", () => {
    expect(normalizeEvent(lsu, "american-football", NOW).score).toEqual({ kind: "team", home: 20, away: 9 })
  })

  it("leaves a live row alone", () => {
    expect(americanFootballRow({ ...southern, strStatus: "Q3" }).intHomeScore).toBe("17")
  })
})

describe("American football details", () => {
  it("names the week, season and place of a regular-season NFL game", () => {
    const event = normalizeEvent(bengals, "american-football", NOW)
    expect(event.details).toMatchObject({ kind: "american-football", week: 8, stage: null, season: "2026" })
    expect(sportChip(event, en)).toBe("Week 8")
    expect(sportChip(event, fr)).toBe("Semaine 8")
    expect(sportFacts(event, en)).toEqual([
      { label: "Week", value: "Week 8" },
      { label: "Season", value: "2026" },
      { label: "Location", value: "Cincinnati, OH, United States" },
    ])
  })

  it("reads each league's playoff codes in its own words", () => {
    const stage = (strLeague: string, intRound: string) => americanFootballDetails({ idEvent: "1", strLeague, intRound }).stage
    expect([stage("NFL", "160"), stage("NFL", "125"), stage("NFL", "150"), stage("NFL", "200"), stage("NFL", "500")]).toEqual(["wild-card", "divisional", "conference-final", "super-bowl", "preseason"])
    // CFL 2026: Winnipeg's 25-22 at Toronto was a division semi-final, Montreal v Winnipeg a division final.
    expect([stage("CFL", "160"), stage("CFL", "150"), stage("CFL", "200")]).toEqual(["division-semi-final", "division-final", "grey-cup"])
    expect([stage("NCAA Division 1", "160"), stage("NCAA Division 1", "180"), stage("NCAA Division 1", "200")]).toEqual(["postseason", "fcs-final", "national-final"])
    expect(stage("UFL", "160")).toBe("conference-final")
    expect(stage("GFL", "125")).toBe("quarter-final")
    expect(americanFootballDetails({ idEvent: "1", strLeague: "NFL", intRound: "160" }).week).toBeNull()
  })

  it("keeps the overtime period in the line score", () => {
    const table = lineScore(normalizeEvent(bengals, "american-football", NOW), en)
    expect(table?.columns.map((column) => column.label)).toEqual(["Q1", "Q2", "Q3", "Q4", "OT", "T"])
    expect(table?.rows[0].cells.map((cell) => cell.value)).toEqual([0, 14, 9, 13, 7, 43])
  })
})

describe("American football in Compare", () => {
  const record = { played: 9, wins: 5, draws: 1, losses: 3, ties: 0, noResults: 0, scored: 0, conceded: 0, counted: 9 }

  it("writes a record won-lost-tied, and only adds the tie when there is one", () => {
    expect(recordFor(record, "american-football")).toBe("5-3-1")
    expect(recordFor({ ...record, draws: 0, played: 8 }, "american-football")).toBe("5-3")
  })

  it("marks a tie T in the form, never D", () => {
    const team = (name: string) => ({ name, record, form: ["W", "D", "L"] as const, next: null })
    const data = { tier: "basic", sportId: "american-football", teams: [team("Washington Commanders"), team("New York Giants")], headToHead: [], fetchedAt: "" } as unknown as Comparison
    expect(teamSheet(data, en).rows[0]).toEqual([en.compare.form, "W T L", "W T L"])
  })
})
