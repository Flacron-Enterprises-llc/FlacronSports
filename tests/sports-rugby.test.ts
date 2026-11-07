import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { rugbyCode } from "@/lib/sports/adapters/rugby"
import { decidedSide } from "@/lib/sports/game-result"
import { sportChip, sportFacts } from "@/lib/sports/sport-terms"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

// Rows as the source sent them in November 2026, trimmed to the fields read.
const IRELAND_ARGENTINA: RawEvent = {
  idEvent: "2449603", idLeague: "5852", strLeague: "Nations Championship", strSeason: "2026", strEvent: "Ireland Rugby vs Argentina Rugby",
  strHomeTeam: "Ireland Rugby", strAwayTeam: "Argentina Rugby", intHomeScore: "42", intAwayScore: "12", intRound: "4", strGroup: "N",
  strTimestamp: "2026-11-06T20:10:00", dateEvent: "2026-11-06", strTime: "20:10:00", strVenue: "Aviva Stadium", strCity: "Dublin", strCountry: "Ireland",
  strResult: "", strStatus: "NS", strPostponed: "no",
}
const FRANCE_ENGLAND: RawEvent = {
  idEvent: "2261722", idLeague: "4714", strLeague: "Six Nations Championship", strSeason: "2026", strEvent: "France Rugby vs England Rugby",
  strHomeTeam: "France Rugby", strAwayTeam: "England Rugby", intHomeScore: "48", intAwayScore: "46", intHomeScoreExtra: "6", intAwayScoreExtra: "7", intRound: "5",
  strTimestamp: "2026-03-14T20:10:00", strResult: "France Rugby First Half:<br>24 27 <br>Second Half<br>24 19 <br>Overtime<br>", strVenue: "Stade de France", strStatus: "FT", strPostponed: "no",
}
const NRL_GRAND_FINAL: RawEvent = {
  idEvent: "2611336", idLeague: "4416", strLeague: "Australian National Rugby League", strSeason: "2026", strEvent: "Sydney Roosters vs Newcastle Knights",
  strHomeTeam: "Sydney Roosters", strAwayTeam: "Newcastle Knights", intHomeScore: "19", intAwayScore: "18", intRound: "200", intSpectators: "80123",
  strTimestamp: "2026-10-04T08:30:00", strCity: "Sydney, NSW", strCountry: "Australia", strStatus: "FT", strPostponed: "no",
  strResult: "The Sydney Roosters claimed their 16th NRL premiership with a dramatic 19-18 victory over the Newcastle Knights at Accor Stadium.",
}
const NOW = new Date("2026-11-07T09:10:00Z")
const t = getDictionary("en")

describe("rugby rows", () => {
  it("reads a finished international still marked not started, hours after kickoff", () => {
    const event = normalizeEvent(IRELAND_ARGENTINA, "rugby", NOW)
    expect(event.status).toBe("finished")
    expect(event.score).toEqual({ kind: "team", home: 42, away: 12 })
    expect(decidedSide(event)).toEqual({ winner: 0 })
  })

  it("does not call that row finished while the game could still be on", () => {
    const event = normalizeEvent(IRELAND_ARGENTINA, "rugby", new Date("2026-11-06T21:30:00Z"))
    expect(event.status).not.toBe("finished")
    expect(event.score.kind).toBe("none")
  })

  it("leaves a past not-started row with no score, or nil-nil, unsettled", () => {
    expect(normalizeEvent({ ...IRELAND_ARGENTINA, intHomeScore: null, intAwayScore: null }, "rugby", NOW).status).toBe("unknown")
    expect(normalizeEvent({ ...IRELAND_ARGENTINA, intHomeScore: "0", intAwayScore: "0" }, "rugby", NOW).status).toBe("unknown")
  })

  it("keeps the end of a season scheduled when the source files it cancelled months ahead", () => {
    const urc: RawEvent = { idEvent: "2550233", idLeague: "4446", strLeague: "United Rugby Championship", strHomeTeam: "Bulls", strAwayTeam: "Connacht", intRound: "18", strTimestamp: "2027-05-15T11:30:00", strStatus: "CANC", strPostponed: "no" }
    expect(normalizeEvent(urc, "rugby", NOW).status).toBe("scheduled")
    const japan: RawEvent = { idEvent: "2348801", idLeague: "5167", strLeague: "Japan Rugby League One", strHomeTeam: "Tokyo Sungoliath", strAwayTeam: "Mitsubishi Sagamihara DynaBoars", intRound: "7", strTimestamp: "2026-02-08T05:30:00", strStatus: "CANC", strPostponed: "no" }
    expect(normalizeEvent(japan, "rugby", NOW).status).toBe("canceled")
  })

  it("shows a result whose postponed flag stayed set after it was played", () => {
    const lions: RawEvent = { idEvent: "2282752", idLeague: "4446", strLeague: "United Rugby Championship", strHomeTeam: "Lions", strAwayTeam: "The Sharks", intHomeScore: "34", intAwayScore: "22", intRound: "8", strTimestamp: "2026-02-21T12:00:00", strStatus: "FT", strPostponed: "yes" }
    const event = normalizeEvent(lions, "rugby", NOW)
    expect(event.status).toBe("finished")
    expect(event.score).toEqual({ kind: "team", home: 34, away: 22 })
  })

  it("keeps a draw a draw", () => {
    const draw: RawEvent = { idEvent: "2550789", idLeague: "4550", strLeague: "European Rugby Champions Cup", strHomeTeam: "Gloucester", strAwayTeam: "Union Bordeaux Bègles", intHomeScore: "36", intAwayScore: "36", strTimestamp: "2026-10-16T19:00:00", strResult: " Gloucester First Half:<br>24 17 <br>Second Half<br>12 19 <br>Overtime<br> ", strStatus: "FT", strPostponed: "no" }
    const event = normalizeEvent(draw, "rugby", NOW)
    expect(decidedSide(event)).toEqual({ winner: null })
    expect(event.breakdown?.segments.map((item) => [item.home, item.away])).toEqual([[24, 17], [12, 19]])
  })
})

describe("rugby details", () => {
  it("names the NRL grand final, its code and its crowd, and ignores prose result text", () => {
    const event = normalizeEvent(NRL_GRAND_FINAL, "rugby", NOW)
    expect(event.details).toMatchObject({ kind: "rugby", code: "league", stage: "grand-final", round: null, spectators: 80123 })
    expect(event.breakdown).toBeUndefined()
    expect(sportChip(event, t)).toBe("Grand Final")
  })

  it("reads NRL finals weeks and preseason trials by their own codes", () => {
    const stage = (round: string) => normalizeEvent({ ...NRL_GRAND_FINAL, intRound: round }, "rugby", NOW).details
    expect(stage("125")).toMatchObject({ stage: "qualifying-final" })
    expect(stage("180")).toMatchObject({ stage: "preliminary-final" })
    expect(stage("500")).toMatchObject({ stage: "preseason", round: null })
  })

  it("keeps a World Cup group and drops the Nations Championship's one-letter filing", () => {
    const rlwc: RawEvent = { idEvent: "2420434", idLeague: "5806", strLeague: "Rugby League World Cup", strSeason: "2026", strHomeTeam: "Lebanon Rugby League", strAwayTeam: "France Rugby League", intHomeScore: "24", intAwayScore: "20", intRound: "3", strGroup: "B", strTimestamp: "2026-11-01T06:50:00", strStatus: "FT", strPostponed: "no" }
    expect(normalizeEvent(rlwc, "rugby", NOW).details).toMatchObject({ code: "league", round: 3, group: "B" })
    const nations = normalizeEvent(IRELAND_ARGENTINA, "rugby", NOW)
    expect(nations.details).toMatchObject({ code: "union", round: 4, group: null, city: "Dublin" })
    expect(sportFacts(nations, t).map((fact) => fact.label)).toEqual([t.sportTerms.discipline, t.sportTerms.round, t.sportTerms.season, t.sportTerms.place])
  })

  it("tells Japan's union League One apart from rugby league", () => {
    expect(rugbyCode("5167")).toBe("union")
    expect(rugbyCode("4415")).toBe("league")
    expect(rugbyCode("5037")).toBe("sevens")
    expect(rugbyCode("5447")).toBeNull()
  })

  it("shows halves and tries together where the Six Nations row states both", () => {
    const event = normalizeEvent(FRANCE_ENGLAND, "rugby", NOW)
    const table = lineScore(event, t)
    expect(table?.rows.map((row) => row.cells.map((cell) => cell.value))).toEqual([[24, 24, 48, 6], [27, 19, 46, 7]])
    expect(decidedSide(event)).toEqual({ winner: 0 })
  })
})
