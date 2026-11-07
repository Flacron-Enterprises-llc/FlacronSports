import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { isGoldenSet } from "@/lib/sports/adapters/volleyball"
import { teamSheet } from "@/lib/sports/compare-rows"
import { advancedFigures, basicProfile, type Comparison } from "@/lib/sports/compare"
import { decidedSide } from "@/lib/sports/game-result"
import { sportChip, sportFacts } from "@/lib/sports/sport-terms"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

const en = getDictionary("en")
const fr = getDictionary("fr")
const NOW = new Date("2026-11-07T12:00:00Z")
const read = (raw: Partial<RawEvent>, now = NOW) => normalizeEvent({ idEvent: "1", ...raw } as RawEvent, "volleyball", now)

// Rows as the source returns them (lookupevent / eventsseason), trimmed to the fields read.
const LUBE_ZAWIERCIE: Partial<RawEvent> = {
  idEvent: "2435812", strTimestamp: "2026-04-02T16:00:00", strEvent: "Aluron CMC Warta Zawiercie vs Volley Lube",
  strFilename: "CEV Champions League 2026-04-02 Aluron CMC Warta Zawiercie vs Volley Lube", idLeague: "5616", strLeague: "CEV Champions League",
  strSeason: "2025-2026", strHomeTeam: "Volley Lube", strAwayTeam: "Aluron CMC Warta Zawiercie", intHomeScore: "3", intRound: "125", intAwayScore: "0",
  dateEvent: "2026-04-02", strTime: "16:00:00", strResult: " Aluron CMC Warta Zawiercie First:<br>25 22 <br>Second<br>25 18 <br>Third<br>26 24 <br>Forth<br><br>Fifth<br> \n\t\t\t\t\t\t\t\t\t",
  strCountry: "Italy", strStatus: "FT", strPostponed: "no",
}

const TRENTO_LEG: Partial<RawEvent> = {
  idEvent: "2435810", strTimestamp: "2026-03-11T19:30:00", strEvent: "Trentino Volley vs Projekt Warsaw", strFilename: "CEV Champions League 2026-03-11 Trentino Volley vs Projekt Warsaw",
  idLeague: "5616", strLeague: "CEV Champions League", strSeason: "2025-2026", strHomeTeam: "Trentino Volley", strAwayTeam: "Projekt Warsaw", intHomeScore: "2", intRound: "160", intAwayScore: "3",
  dateEvent: "2026-03-11", strTime: "19:30:00", strResult: " Trentino Volley First:<br>23 25 <br>Second<br>25 19 <br>Third<br>25 19 <br>Forth<br><br>Fifth<br>12 15\n\t\t\t\t\t\t\t\t\t",
  strVenue: "PalaTrento", strCountry: "Italy", strStatus: "FT", strPostponed: "no",
}
const GOLDEN_SET: Partial<RawEvent> = { ...TRENTO_LEG, idEvent: "2447950", strTimestamp: "2026-03-11T22:15:00", strTime: "22:15:00", intHomeScore: "11", intAwayScore: "15", strResult: " Trentino Volley First:<br>  <br>Second<br>  <br>Third<br>  <br>Forth<br><br>Fifth<br> \n\t\t\t\t\t\t\t\t\t" }

describe("volleyball rows titled away side first", () => {
  it("gives Zawiercie the 3-0 the title, result text and real match agree on", () => {
    const event = read(LUBE_ZAWIERCIE)
    expect(event.participants.map((side) => side.name)).toEqual(["Volley Lube", "Aluron CMC Warta Zawiercie"])
    expect(event.score).toEqual({ kind: "team", home: 0, away: 3 })
    expect(decidedSide(event)).toEqual({ winner: 1 })
    expect(event.breakdown?.segments.slice(0, 3)).toEqual([
      { kind: "set", number: 1, home: 22, away: 25 },
      { kind: "set", number: 2, home: 18, away: 25 },
      { kind: "set", number: 3, home: 24, away: 26 },
    ])
  })
  it("leaves a row titled home first alone", () => {
    expect(read(TRENTO_LEG).score).toEqual({ kind: "team", home: 2, away: 3 })
  })
})

describe("golden set", () => {
  it("reads the golden set row as points, with no match winner for tables, form or picks", () => {
    const event = read(GOLDEN_SET)
    expect(event.details).toMatchObject({ kind: "volleyball", goldenSet: true })
    expect(event.breakdown).toBeUndefined()
    expect(decidedSide(event)).toBeNull()
    expect(sportChip(event, en)).toBe("Golden set, score in points")
    expect(sportChip(event, fr)).toBe("Set en or, score en points")
  })
  it("tells a golden set from a match score", () => {
    expect([isGoldenSet(11, 15), isGoldenSet(17, 15), isGoldenSet(15, 14), isGoldenSet(3, 1), isGoldenSet(18, 15)]).toEqual([true, true, false, false, false])
    expect(read(TRENTO_LEG).details).toMatchObject({ goldenSet: false })
  })
  it("keeps the fifth set and the empty fourth of the leg before it", () => {
    const sets = read(TRENTO_LEG).breakdown?.segments ?? []
    expect(sets).toHaveLength(5)
    expect(sets[3]).toEqual({ kind: "set", number: 4, home: null, away: null })
    expect(sets[4]).toEqual({ kind: "set", number: 5, home: 12, away: 15 })
  })
})

describe("PlusLiga games not yet timed", () => {
  const untimed: Partial<RawEvent> = {
    idEvent: "2553947", idLeague: "5619", strLeague: "Polish PlusLiga", strSeason: "2026-2027", strHomeTeam: "Projekt Warsaw", strAwayTeam: "Asseco Resovia",
    intRound: "6", strTimestamp: "2026-11-14T17:00:00", dateEvent: "2026-11-14", strTime: "17:00:00", strStatus: "CANC", strPostponed: "no",
  }
  it("shows a future CANC as upcoming on its date, with no time", () => {
    const event = read(untimed)
    expect(event.status).toBe("scheduled")
    expect(event.dateOnly).toBe(true)
    expect(event.scheduledStartUTC).toBe("2026-11-14T00:00:00.000Z")
    expect(event.score).toEqual({ kind: "none" })
  })
  it("keeps a CANC once its date has passed", () => {
    expect(read(untimed, new Date("2026-11-15T12:00:00Z")).status).toBe("canceled")
  })
})

it("reads a Greek row with a match score and no status as finished", () => {
  const event = read({ idEvent: "2554134", strLeague: "Greek A1 Ethniki", strHomeTeam: "AO Kalamata", strAwayTeam: "Panionios GSS", intHomeScore: "3", intAwayScore: "0", intRound: "0", strTimestamp: "2026-04-01T16:00:00", dateEvent: "2026-04-01", strTime: "16:00:00", strPostponed: "no" })
  expect(event.status).toBe("finished")
  expect(event.score).toEqual({ kind: "team", home: 3, away: 0 })
  expect(read({ idEvent: "2554136", strHomeTeam: "Panionios GSS", strAwayTeam: "OFI Volleyball", strTimestamp: "2026-04-08T14:00:00", dateEvent: "2026-04-08", strTime: "14:00:00" }).status).toBe("unknown")
})

describe("stages", () => {
  it("names a Nations League third place match, but not the European cups' round 160", () => {
    const vnl = read({ strLeague: "FIVB Volleyball Mens Nations League", intRound: "160", strHomeTeam: "Japan Volleyball", strAwayTeam: "Slovenia Volleyball", intHomeScore: "1", intAwayScore: "3", strStatus: "FT", strTimestamp: "2026-08-02T12:00:00" })
    expect(sportFacts(vnl, en)).toContainEqual({ label: en.sportTerms.stage, value: "Third place match" })
    expect(read(TRENTO_LEG).details).toMatchObject({ stage: null, round: null })
    expect(read({ ...LUBE_ZAWIERCIE }).details).toMatchObject({ stage: "quarter" })
    expect(read({ strLeague: "Mens European Volleyball Championship", intRound: "160", strDescriptionEN: "Third Place Playoff", strHomeTeam: "A", strAwayTeam: "B", strStatus: "FT", intHomeScore: "3", intAwayScore: "0", strTimestamp: "2026-09-26T12:00:00" }).details).toMatchObject({ stage: "third-place" })
  })
  it("keeps the round and group of a league game", () => {
    const event = read({ strLeague: "Mens European Volleyball Championship", intRound: "16", strGroup: "A", strHomeTeam: "A", strAwayTeam: "B", strStatus: "NS", strTimestamp: "2026-11-20T12:00:00", strSeason: "2026" })
    expect(sportChip(event, en)).toBe("Round 16 · Group A")
  })
})

describe("Compare in sets", () => {
  it("counts straight-set wins and losses without a set from the sets score", () => {
    const game = (id: string, home: string, away: string, homeSets: number, awaySets: number) => read({ idEvent: id, strHomeTeam: home, strAwayTeam: away, intHomeScore: String(homeSets), intAwayScore: String(awaySets), strStatus: "FT", strTimestamp: `2026-11-0${id}T17:00:00`, strLeague: "Italian Volleyball League" })
    const recent = [game("1", "Perugia", "Trento", 3, 0), game("2", "Lube", "Perugia", 3, 0), game("3", "Perugia", "Monza", 3, 2), read(GOLDEN_SET)]
    const profile = (name: string) => ({ ...basicProfile(name, recent, []), advanced: { ...advancedFigures(name, recent), standing: null } })
    const data: Comparison = { tier: "advanced", sportId: "volleyball", teams: [profile("Perugia"), profile("Lube")], headToHead: [], fetchedAt: NOW.toISOString() }
    const rows = teamSheet(data, en).rows
    expect(rows).toContainEqual(["Won-lost", "2-1", "1-0"])
    expect(rows).toContainEqual(["Sets won per match", "2.0", "3.0"])
    expect(rows).toContainEqual(["Wins in straight sets", "1", "1"])
    expect(rows).toContainEqual(["Losses without a set", "1", "0"])
    expect(teamSheet(data, fr).rows).toContainEqual(["Victoires en sets secs", "1", "1"])
  })
})
