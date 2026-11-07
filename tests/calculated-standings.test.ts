// Fixtures keep the feed's real shape and invented teams. The numbers are made up to pin each rule.
import { beforeEach, describe, expect, it, vi } from "vitest"

const docs = new Map<string, Record<string, unknown>>()

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => null,
  getAdminDb: () => ({
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
        set: async (value: Record<string, unknown>) => void docs.set(id, value),
      }),
    }),
  }),
}))

import { calculateTable, canHaveTable, leagueGames } from "@/lib/sports/calculated"
import { clearFeedCache, getStandings } from "@/lib/sports/service"
import type { RawEvent } from "@/lib/sports/thesportsdb"

const now = new Date("2026-11-07T12:00:00Z")
const LEAGUE = "9001"
let nextId = 1

interface GameOptions {
  round?: number
  status?: string
  date?: string
  postponed?: string
  text?: string
  league?: string
}

function game(home: string, away: string, homeScore: number | null, awayScore: number | null, options: GameOptions = {}): RawEvent {
  const { round = 1, status = "FT", date = "2026-10-20", postponed = "no", text = null, league = "Harbor League" } = options
  return {
    idEvent: String(nextId++),
    idLeague: LEAGUE,
    strLeague: league,
    strEvent: `${home} vs ${away}`,
    idHomeTeam: `id-${home}`,
    idAwayTeam: `id-${away}`,
    strHomeTeam: home,
    strAwayTeam: away,
    intHomeScore: homeScore === null ? null : String(homeScore),
    intAwayScore: awayScore === null ? null : String(awayScore),
    intRound: String(round),
    strStatus: status,
    strPostponed: postponed,
    dateEvent: date,
    strTimestamp: `${date}T19:00:00`,
    strResult: text,
  }
}

/** Everyone plays everyone once, so the shape checks pass and only the given games differ. */
function roundRobin(teams: string[], score: (home: string, away: string) => [number, number], options: GameOptions = {}): RawEvent[] {
  return teams.flatMap((home, index) => teams.slice(index + 1).map((away) => game(home, away, ...score(home, away), options)))
}

const LADDER = ["Alpha", "Bravo", "Charlie", "Delta"]
const higherWins = (scale = 1) => (home: string, away: string): [number, number] => (LADDER.indexOf(home) < LADDER.indexOf(away) ? [3 * scale, 1 * scale] : [1 * scale, 3 * scale])
const row = (table: ReturnType<typeof calculateTable>, team: string) => table?.rows.find((item) => item.team === team)

describe("calculated tables by sport", () => {
  it("basketball: win percentage, points and difference, with no draws or points column", () => {
    const table = calculateTable(roundRobin(LADDER, higherWins(35)), "basketball", LEAGUE, "Harbor League", now)
    expect(table).toMatchObject({ games: 6, latestGame: "2026-10-20", unit: "points" })
    expect(row(table, "Alpha")).toMatchObject({ rank: 1, played: 3, won: 3, lost: 0, drawn: null, winPercent: 1, scoredFor: 315, scoredAgainst: 105, difference: 210, points: null, form: null })
    expect(row(table, "Delta")).toMatchObject({ rank: 4, won: 0, lost: 3, winPercent: 0 })
  })

  it("American football: a tie counts as half a win and shows its column", () => {
    const rows = roundRobin(LADDER, (home, away) => (home === "Alpha" && away === "Bravo" ? [20, 20] : higherWins(7)(home, away)))
    const table = calculateTable(rows, "american-football", LEAGUE, "Harbor League", now)
    expect(row(table, "Alpha")).toMatchObject({ rank: 1, won: 2, drawn: 1, lost: 0, winPercent: 0.833 })
    expect(row(table, "Charlie")).toMatchObject({ won: 1, drawn: 0, lost: 2, winPercent: 0.333 })
  })

  it("baseball: a game flagged postponed and later played still counts", () => {
    const rows = roundRobin(LADDER, higherWins(), { postponed: "yes" })
    expect(calculateTable(rows, "baseball", LEAGUE, "Harbor League", now)?.games).toBe(6)
  })

  it("ice hockey: splits overtime and shootout losses when the games state them, and shows no points", () => {
    const rows = roundRobin(LADDER, higherWins())
    rows[0].strStatus = "AOT"
    rows[1].strStatus = "AP"
    const table = calculateTable(rows, "ice-hockey", LEAGUE, "Harbor League", now)
    expect(table?.unit).toBe("goals")
    expect(row(table, "Bravo")).toMatchObject({ won: 2, lost: 0, overtimeLosses: 1, points: null, scoredFor: 7, scoredAgainst: 5 })
    expect(row(table, "Charlie")).toMatchObject({ won: 1, lost: 1, overtimeLosses: 1 })
    expect(row(table, "Alpha")?.difference).toBeNull()
    expect(row(table, "Alpha")?.winPercent).toBeUndefined()
  })

  it("ice hockey: leaves the column out when the feed never marks how games ended", () => {
    const table = calculateTable(roundRobin(LADDER, higherWins()), "ice-hockey", LEAGUE, "Harbor League", now)
    expect(row(table, "Delta")).toMatchObject({ lost: 3 })
    expect(row(table, "Delta")?.overtimeLosses).toBeUndefined()
  })

  it("volleyball: sets for and against, and a score that is not sets is not read", () => {
    const rows = roundRobin(LADDER, higherWins())
    rows.push(game("Alpha", "Delta", 25, 20), game("Alpha", "Delta", 2, 2))
    const table = calculateTable(rows, "volleyball", LEAGUE, "Harbor League", now)
    expect(table).toMatchObject({ games: 6, unit: "sets" })
    expect(row(table, "Alpha")).toMatchObject({ won: 3, lost: 0, scoredFor: 9, scoredAgainst: 3, drawn: null })
  })

  it("rugby: won, drawn, lost, with the draw column even when nobody drew", () => {
    const table = calculateTable(roundRobin(LADDER, higherWins(10)), "rugby", LEAGUE, "Harbor League", now)
    expect(row(table, "Alpha")).toMatchObject({ won: 3, drawn: 0, lost: 0, scoredFor: 90, scoredAgainst: 30, difference: null })
    expect(row(table, "Alpha")?.winPercent).toBeUndefined()
  })

  const t20 = (home: string, away: string): [number, number] => (LADDER.indexOf(home) < LADDER.indexOf(away) ? [180, 150] : [150, 180])

  it("cricket: stated results beat the totals, and the higher total decides the rest", () => {
    const rows = roundRobin(LADDER, t20, { league: "Harbor Premier League" })
    rows[0].strResult = "Bravo won by 8 runs (DLS method)"
    const table = calculateTable(rows, "cricket", LEAGUE, "Harbor Premier League", now)
    expect(table?.unit).toBe("runs")
    expect(row(table, "Bravo")).toMatchObject({ won: 3, lost: 0, drawn: 0 })
    expect(row(table, "Alpha")).toMatchObject({ won: 2, lost: 1 })
  })

  it("cricket: a rained off game, a level total or a blank score is left out, not guessed", () => {
    const rows = roundRobin(LADDER, t20, { league: "Harbor Premier League" })
    rows.push(game("Alpha", "Bravo", 201, 7, { league: "Harbor Premier League" }), game("Alpha", "Charlie", 150, 150, { league: "Harbor Premier League" }), game("Alpha", "Delta", 25, null, { league: "Harbor Premier League" }))
    expect(calculateTable(rows, "cricket", LEAGUE, "Harbor Premier League", now)?.games).toBe(6)
  })

  it("cricket: across two innings only a stated result counts", () => {
    const rows = roundRobin(LADDER, t20, { league: "Harbor County Championship" })
    expect(calculateTable(rows, "cricket", LEAGUE, "Harbor County Championship", now)).toBeNull()
    for (const raw of rows) raw.strResult = `${raw.strHomeTeam} won by 8 runs`
    const table = calculateTable(rows, "cricket", LEAGUE, "Harbor County Championship", now)
    expect(table?.games).toBe(6)
  })
})

describe("which games a table counts", () => {
  const league = () => roundRobin(LADDER, higherWins())

  it("leaves out unplayed, cancelled, live and blank games", () => {
    const rows = [
      ...league(),
      game("Alpha", "Bravo", null, null, { status: "NS", date: "2026-11-20" }),
      game("Alpha", "Bravo", null, null, { status: "CANC" }),
      game("Alpha", "Bravo", 1, 0, { status: "Q2" }),
      game("Alpha", "Bravo", 0, 0),
    ]
    expect(calculateTable(rows, "basketball", LEAGUE, "Harbor League", now)?.games).toBe(6)
  })

  it("does not trust a finished status dated in the future", () => {
    const rows = [...league(), game("Alpha", "Bravo", 90, 80, { date: "2026-12-01" })]
    expect(calculateTable(rows, "basketball", LEAGUE, "Harbor League", now)?.games).toBe(6)
  })

  it("excludes preseason, playoff rounds, all-star games and other leagues' rows", () => {
    const rows = [
      ...league(),
      game("Alpha", "Bravo", 1, 3, { round: 500, date: "2026-09-20" }),
      game("Alpha", "Bravo", 1, 3, { round: 125, date: "2026-10-25" }),
      game("Alpha", "Bravo", 1, 3, { round: 200, date: "2026-10-26" }),
      { ...game("Alpha", "Bravo", 1, 3), strEvent: "Alpha All-Stars vs Bravo All-Stars" },
      { ...game("Alpha", "Bravo", 1, 3), idLeague: "9002" },
    ]
    expect(calculateTable(rows, "basketball", LEAGUE, "Harbor League", now)?.games).toBe(6)
  })

  it("keeps preseason games when the league is the preseason competition", () => {
    const rows = roundRobin(LADDER, higherWins(), { round: 500, league: "Harbor Spring Training" })
    expect(calculateTable(rows, "baseball", LEAGUE, "Harbor Spring Training", now)?.games).toBe(6)
  })

  it("stops a team at its schedule, wherever the playoffs are filed", () => {
    const six = [...LADDER, "Echo", "Foxtrot"]
    const rows = [
      ...roundRobin(six, () => [3, 1], { date: "2026-10-01" }),
      game("Alpha", "Bravo", 3, 1, { round: 0, date: "2026-10-20" }),
      game("Bravo", "Alpha", 3, 1, { round: 3, date: "2026-10-21" }),
    ]
    expect(leagueGames(rows, LEAGUE, "Harbor League")).toHaveLength(15)
  })

  it("keeps every game of a season whose rounds are not numbered yet", () => {
    const rows = roundRobin(LADDER, higherWins(), { round: 0 })
    expect(calculateTable(rows, "basketball", LEAGUE, "Harbor League", now)?.games).toBe(6)
  })

  it("keeps a team's games in hand: unplayed games count towards the schedule", () => {
    const played = roundRobin(LADDER, higherWins(), { date: "2026-10-01" })
    const toCome = roundRobin(LADDER, () => [0, 0], { status: "NS", date: "2026-12-01" }).map((raw) => ({ ...raw, intHomeScore: null, intAwayScore: null }))
    const catchUp = game("Alpha", "Bravo", 3, 1, { date: "2026-10-05" })
    expect(calculateTable([...played, ...toCome.slice(1), catchUp], "basketball", LEAGUE, "Harbor League", now)?.games).toBe(7)
  })

  it("skips unlabelled spring exhibitions in leagues that file them with the season", () => {
    const rows = [...roundRobin(LADDER, higherWins(), { round: 0, date: "2026-04-10" }), game("Delta", "Alpha", 9, 1, { round: 0, date: "2026-03-05" })].map((raw) => ({ ...raw, idLeague: "4591" }))
    expect(calculateTable(rows, "baseball", "4591", "Nippon Baseball League", now)?.games).toBe(6)
  })
})

describe("ranking", () => {
  it("orders by win percentage, then difference, and shares a place when both are level", () => {
    const rows = [game("Alpha", "Bravo", 100, 90), game("Charlie", "Delta", 100, 90), game("Alpha", "Delta", 120, 90), game("Bravo", "Charlie", 100, 90)]
    const table = calculateTable(rows, "basketball", LEAGUE, "Harbor League", now)
    expect(table?.rows.map((item) => [item.rank, item.team])).toEqual([[1, "Alpha"], [2, "Bravo"], [2, "Charlie"], [4, "Delta"]])
  })
})

describe("when there is no table to show", () => {
  it("needs enough games", () => {
    expect(calculateTable([game("Alpha", "Bravo", 3, 1), game("Charlie", "Delta", 3, 1), game("Alpha", "Charlie", 3, 1)], "basketball", LEAGUE, "Harbor League", now)).toBeNull()
  })

  it("refuses a knockout, where losers stop playing", () => {
    const rows = [game("A", "B", 3, 1), game("C", "D", 3, 1), game("E", "F", 3, 1), game("G", "H", 3, 1), game("A", "C", 3, 1), game("E", "G", 3, 1), game("A", "E", 3, 1)]
    expect(calculateTable(rows, "basketball", LEAGUE, "Harbor League", now)).toBeNull()
  })

  it("refuses pools that never meet", () => {
    const pool = (names: string[]) => names.flatMap((home, index) => names.slice(index + 1).map((away) => game(home, away, 3, 1)))
    expect(calculateTable([...pool(["A", "B", "C", "D"]), ...pool(["E", "F", "G", "H"])], "basketball", LEAGUE, "Harbor League", now)).toBeNull()
  })

  it("refuses sports with no table of this kind, and competitions that cannot have one", () => {
    expect(calculateTable(roundRobin(LADDER, higherWins()), "football", LEAGUE, "Harbor League", now)).toBeNull()
    expect(canHaveTable("basketball", "NBA")).toBe(true)
    expect(canHaveTable("rugby", "Currie Cup")).toBe(true)
    for (const [sport, name] of [["basketball", "NBA Cup"], ["rugby", "European Rugby Champions Cup"], ["cricket", "One Day International Series"], ["basketball", "NCAA Division I Basketball Mens"], ["basketball", "_No League Basketball"], ["baseball", "World Baseball Classic"], ["rugby", "Rugby Union Club Friendlies"]] as const) {
      expect(canHaveTable(sport, name)).toBe(false)
    }
    expect(canHaveTable("football", "Premier League")).toBe(false)
  })
})

describe("getStandings", () => {
  const league = { idLeague: LEAGUE, strLeague: "Harbor League", strSport: "Basketball", strCurrentSeason: "2026-2027" }
  const season = () => roundRobin(LADDER, higherWins(35))

  const provider = (overrides: { table?: unknown[]; failSeason?: boolean; sport?: string } = {}) =>
    vi.fn(async (url: string | URL | Request) => {
      const path = String(url)
      if (path.includes("lookuptable")) return new Response(overrides.table ? JSON.stringify({ table: overrides.table }) : "")
      if (path.includes("lookupleague")) return new Response(JSON.stringify({ leagues: [{ ...league, strSport: overrides.sport ?? league.strSport }] }))
      if (path.includes("search_all_seasons")) return new Response(JSON.stringify({ seasons: [{ strSeason: "2025-2026" }, { strSeason: "2026-2027" }] }))
      if (path.includes("eventsseason")) return overrides.failSeason ? new Response("", { status: 500 }) : new Response(JSON.stringify({ events: season() }))
      return new Response("{}")
    })

  beforeEach(() => {
    docs.clear()
    clearFeedCache()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it("keeps the provider's real table when it has one, and spends nothing on a season", async () => {
    const fetcher = provider({ table: [{ intRank: "1", strTeam: "Alpha", intPoints: "9", strLeague: "Harbor League" }] })
    vi.stubGlobal("fetch", fetcher)
    const table = await getStandings(LEAGUE)
    expect(table.state).toBe("ok")
    expect(table.calculated).toBeUndefined()
    expect(table.rows[0]).toMatchObject({ team: "Alpha", points: 9 })
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("eventsseason"))).toBe(false)
  })

  it("calculates a table otherwise, labelled with what it counted", async () => {
    vi.stubGlobal("fetch", provider())
    const table = await getStandings(LEAGUE)
    expect(table).toMatchObject({ state: "ok", league: "Harbor League", season: "2026-2027" })
    expect(table.calculated).toMatchObject({ games: 6, unit: "points", stale: false })
    expect(table.rows[0]).toMatchObject({ team: "Alpha", rank: 1 })
  })

  it("spends no provider calls after the first page view, even after a restart", async () => {
    const fetcher = provider()
    vi.stubGlobal("fetch", fetcher)
    await getStandings(LEAGUE)
    const first = fetcher.mock.calls.length
    expect(first).toBeGreaterThan(0)
    await getStandings(LEAGUE)
    clearFeedCache()
    const again = await getStandings(LEAGUE)
    expect(fetcher.mock.calls.length).toBe(first)
    expect(again.calculated?.games).toBe(6)
  })

  it("stores only the table, because a whole season can pass a document's size limit", async () => {
    vi.stubGlobal("fetch", provider())
    await getStandings(LEAGUE)
    const stored = [...docs.values()].map((doc) => (doc.packed as Uint8Array).length)
    expect(stored.length).toBeGreaterThan(0)
    for (const size of stored) expect(size).toBeLessThan(1_000_000)
  })

  it("refreshes once a day", async () => {
    const fetcher = provider()
    vi.stubGlobal("fetch", fetcher)
    vi.useFakeTimers({ now, toFake: ["Date"] })
    await getStandings(LEAGUE)
    const seasonCalls = () => fetcher.mock.calls.filter(([url]) => String(url).includes("eventsseason")).length
    expect(seasonCalls()).toBe(1)
    vi.setSystemTime(now.getTime() + 23 * 3_600_000)
    await getStandings(LEAGUE)
    expect(seasonCalls()).toBe(1)
    vi.setSystemTime(now.getTime() + 25 * 3_600_000)
    await getStandings(LEAGUE)
    expect(seasonCalls()).toBe(2)
  })

  it("remembers that a league has no table, so an empty page costs no more calls that day", async () => {
    const fetcher = provider({ sport: "Basketball" })
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => (String(url).includes("eventsseason") ? new Response(JSON.stringify({ events: [] })) : fetcher(url))))
    const first = await getStandings(LEAGUE)
    expect(first).toMatchObject({ state: "empty", league: "Harbor League", rows: [] })
    expect(first.calculated).toBeUndefined()
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    await getStandings(LEAGUE)
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls)
  })

  it("stays empty for a football league with no table, as before", async () => {
    vi.stubGlobal("fetch", provider({ sport: "Soccer" }))
    expect(await getStandings(LEAGUE)).toMatchObject({ state: "empty", league: null })
  })

  it("says unavailable when the season cannot be read and nothing is stored", async () => {
    vi.stubGlobal("fetch", provider({ failSeason: true }))
    expect((await getStandings(LEAGUE)).state).toBe("unavailable")
  })

  it("keeps yesterday's table, marked stale, when the refresh fails", async () => {
    vi.stubGlobal("fetch", provider())
    vi.useFakeTimers({ now, toFake: ["Date"] })
    await getStandings(LEAGUE)
    vi.setSystemTime(now.getTime() + 25 * 3_600_000)
    vi.stubGlobal("fetch", provider({ failSeason: true }))
    const table = await getStandings(LEAGUE)
    expect(table.state).toBe("ok")
    expect(table.calculated).toMatchObject({ games: 6, stale: true })
    expect(table.fetchedAt).toBe(now.toISOString())
  })
})
