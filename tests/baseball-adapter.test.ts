import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { baseballRow } from "@/lib/sports/adapters/baseball"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { calculateTable } from "@/lib/sports/calculated"
import { recordFor } from "@/lib/sports/compare-rows"
import { decidedSide } from "@/lib/sports/game-result"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

const en = getDictionary("en")
const now = new Date("2026-11-07T09:00:00Z")
const game = (raw: Partial<RawEvent>) => normalizeEvent({ idEvent: "1", strSport: "Baseball", strPostponed: "no", ...raw } as RawEvent, "baseball", now)
const cells = (event: ReturnType<typeof game>) => lineScore(event, en)?.rows.map((row) => `${row.name}: ${row.cells.map((cell) => cell.value ?? "-").join(" ")}`)

describe("baseball rows", () => {
  it("swaps the scores of a game titled away side first (2420582)", () => {
    const event = game({
      idEvent: "2420582", strEvent: "Adelaide Giants vs Sydney Blue Sox", strHomeTeam: "Sydney Blue Sox", strAwayTeam: "Adelaide Giants",
      intHomeScore: "3", intAwayScore: "2", strStatus: "FT", strTimestamp: "2026-01-23T08:00:00", strVenue: "Blacktown Baseball Stadium",
      strResult: " Adelaide Giants Innings:<br>0 0 0 1 0 0 0 1 1 <br>Hits: 6 - Errors: 1<br><br>Sydney Blue Sox Innings:<br>0 2 0 0 0 0 0 0 0 <br>Hits: 5 - Errors: 1",
    })
    expect(event.score).toEqual({ kind: "team", home: 2, away: 3 })
    expect(decidedSide(event)).toEqual({ winner: 1 })
    expect(cells(event)).toEqual(["Adelaide Giants: 0 0 0 1 0 0 0 1 1 3 6 1", "Sydney Blue Sox: 0 2 0 0 0 0 0 0 0 2 5 1"])
  })

  it("shows a made-up game as played though the postponed flag stayed (2574611, seven innings)", () => {
    const event = game({
      idEvent: "2574611", strEvent: "Cañeros de Los Mochis vs Naranjeros de Hermosillo", strHomeTeam: "Cañeros de Los Mochis", strAwayTeam: "Naranjeros de Hermosillo",
      intHomeScore: "4", intAwayScore: "2", strStatus: "FT", strPostponed: "yes", strTimestamp: "2026-11-01T02:30:00",
      strResult: " Cañeros de Los Mochis Innings:<br>0 1 0 2 1 0    <br>Hits: 7 - Errors: 0<br><br>Naranjeros de Hermosillo Innings:<br>1 0 1 0 0 0 0   <br>Hits: 5 - Errors: 0",
    })
    expect(event.status).toBe("finished")
    expect(lineScore(event, en)?.columns.map((column) => column.label)).toEqual(["1", "2", "3", "4", "5", "6", "7", "R", "H", "E"])
    expect(cells(event)?.[1]).toBe("Cañeros de Los Mochis: 0 1 0 2 1 0 X 4 7 0")
  })

  it("keeps a canceled game canceled though the postponed flag is set", () => {
    expect(game({ strStatus: "CANC", strPostponed: "yes", strTimestamp: "2026-09-27T17:05:00", strHomeTeam: "New York Yankees", strAwayTeam: "Baltimore Orioles" }).status).toBe("canceled")
  })

  it("lists a postponed game moved to a later date as upcoming there (2574618), and a postponed one as postponed (2574634)", () => {
    expect(game({ strStatus: "NS", strPostponed: "yes", strTimestamp: "2026-11-10T02:00:00" }).status).toBe("scheduled")
    expect(game({ strStatus: "POST", strPostponed: "yes", strTimestamp: "2026-11-07T02:30:00" }).status).toBe("postponed")
  })

  it("does not call a game canceled months before its schedule is set", () => {
    expect(game({ strStatus: "CANC", strTimestamp: "2026-12-10T02:30:00" }).status).toBe("scheduled")
    expect(game({ strStatus: "CANC", strTimestamp: "2026-11-20T02:30:00" }).status).toBe("canceled")
  })

  it("does not call a game with no result entered finished", () => {
    const event = game({ strStatus: "FT", intHomeScore: null, intAwayScore: null, strTimestamp: "2026-04-14T09:30:00" })
    expect(event.status).toBe("unknown")
    expect(event.score).toEqual({ kind: "none" })
  })

  it("keeps the innings of an abandoned game, with no skipped-inning mark (2609201)", () => {
    const event = game({
      strHomeTeam: "Cardenales de Lara", strAwayTeam: "Caribes de Anzoátegui", strEvent: "Cardenales de Lara vs Caribes de Anzoátegui",
      intHomeScore: "0", intAwayScore: "1", strStatus: "ABD", strTimestamp: "2026-11-05T23:00:00",
      strResult: " Cardenales de Lara Innings:<br>0 0 0       <br>Hits: 1 - Errors: 0<br><br>Caribes de Anzoátegui Innings:<br>0 0 1       <br>Hits: 2 - Errors: 0",
    })
    expect(event.status).toBe("abandoned")
    expect(decidedSide(event)).toBeNull()
    expect(cells(event)).toEqual(["Caribes de Anzoátegui: 0 0 1 1 2 0", "Cardenales de Lara: 0 0 0 0 1 0"])
  })

  it("puts extra innings in one column worked out from the score (2620494)", () => {
    const event = game({
      strHomeTeam: "Tomateros de Culiacán", strAwayTeam: "Jaguares de Nayarit", strEvent: "Tomateros de Culiacán vs Jaguares de Nayarit",
      intHomeScore: "7", intAwayScore: "10", strStatus: "FT", strTimestamp: "2026-11-07T02:05:00",
      strResult: " Tomateros de Culiacán Innings:<br>1 2 2 0 0 1 0 0 0 4<br>Hits: 13 - Errors: 0<br><br>Jaguares de Nayarit Innings:<br>0 0 1 0 2 2 1 0 0 4<br>Hits: 14 - Errors: 1",
    })
    expect(cells(event)).toEqual(["Jaguares de Nayarit: 0 0 1 0 2 2 1 0 0 4 10 14 1", "Tomateros de Culiacán: 1 2 2 0 0 1 0 0 0 1 7 13 0"])
  })

  it("leaves a row with nothing to settle as it is", () => {
    const raw = { idEvent: "2625622", strEvent: "Samsung Lions vs KT Wiz", strHomeTeam: "Samsung Lions", strAwayTeam: "KT Wiz", intHomeScore: "10", intAwayScore: "5", strStatus: "FT", strPostponed: "no" } as RawEvent
    expect(baseballRow(raw, now)).toEqual(raw)
  })
})

describe("baseball standings and records", () => {
  let id = 100
  const row = (home: string, away: string, homeScore: number, awayScore: number, extra: Partial<RawEvent> = {}): RawEvent => ({
    idEvent: String(id++), idLeague: "4830", strLeague: "Korean KBO League", strEvent: `${home} vs ${away}`, idHomeTeam: home, idAwayTeam: away, strHomeTeam: home, strAwayTeam: away,
    intHomeScore: String(homeScore), intAwayScore: String(awayScore), intRound: "0", strStatus: "FT", strPostponed: "no", dateEvent: "2026-06-10", strTimestamp: "2026-06-10T09:30:00", ...extra,
  })

  it("leaves ties out of the percentage, as KBO and NPB do", () => {
    const rows = [row("KT", "LG", 5, 2), row("KT", "SSG", 3, 3), row("KT", "NC", 1, 4), row("LG", "SSG", 2, 1), row("LG", "NC", 6, 0), row("SSG", "NC", 2, 2)]
    const table = calculateTable(rows, "baseball", "4830", "Korean KBO League", now)
    const kt = table?.rows.find((team) => team.team === "KT")
    expect(table?.unit).toBe("baseball-runs")
    expect(kt).toMatchObject({ won: 1, drawn: 1, lost: 1, winPercent: 0.5 })
    expect(table?.rows[0]).toMatchObject({ team: "LG", won: 2, lost: 1, winPercent: 0.667 })
  })

  it("counts a made-up game the source still flags as postponed, and a reversed title the right way round", () => {
    const rows = [
      row("A", "B", 4, 2, { strPostponed: "yes" }), row("A", "C", 1, 0), row("A", "D", 1, 0),
      row("B", "C", 3, 1), row("B", "D", 2, 1),
      // Titled away side first, with the scores in title order: D won 7-2 at C.
      row("C", "D", 7, 2, { strEvent: "D vs C" }),
    ]
    const table = calculateTable(rows, "baseball", "4830", "Korean KBO League", now)
    expect(table?.rows.find((team) => team.team === "A")).toMatchObject({ won: 3, lost: 0 })
    expect(table?.rows.find((team) => team.team === "D")).toMatchObject({ won: 1, lost: 2, scoredFor: 8, scoredAgainst: 5 })
  })

  it("writes a record won-lost-tied, adding the tie only when there is one", () => {
    const record = { played: 144, wins: 90, draws: 5, losses: 49, ties: 0, noResults: 0, scored: 0, conceded: 0, counted: 144 }
    expect(recordFor(record, "baseball")).toBe("90-49-5")
    expect(recordFor({ ...record, draws: 0, played: 139 }, "baseball")).toBe("90-49")
  })
})
