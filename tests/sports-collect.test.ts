// Synthetic rows shaped like the league lists. Names are invented; ids, dates and the
// layout of each field follow the real responses.
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
    doc: () => ({ get: async () => ({ exists: false }) }),
  }),
}))

import { activeLeagues, chooseLeagues, CALLS_PER_TICK, dayPath, fileRows, inCollectWindow, leaguePaths, mergeRow, mergeRows, nextDates, RESULT_CALLS, resultsWanted, rowDate, slimRow, type CollectLeague, type CollectStore } from "@/lib/sports/collect"
import { clearFeedCache, collectLeagueEvents, getEvents, storedEvents } from "@/lib/sports/service"
import type { RawEvent } from "@/lib/sports/thesportsdb"

const TICK = 15 * 60_000
const NOW = new Date("2026-11-07T12:00:00Z")

const row = (id: string, date: string, extra: Partial<RawEvent> = {}): RawEvent => ({
  idEvent: id, idLeague: "4461", strLeague: "Harbor Bash", strSport: "Cricket", strEvent: "North vs South", strHomeTeam: "North", strAwayTeam: "South",
  dateEvent: date, strTimestamp: `${date}T08:00:00`, strTime: "08:00:00", strPostponed: "no", ...extra,
})

const league = (id: number): CollectLeague => ({ id: String(id), name: `League ${id}`, sportId: "cricket", providerKey: "Cricket" })
const cricket = { providerKey: "Cricket" }

function memoryStore() {
  const days = new Map<string, RawEvent[]>()
  const store: CollectStore = { readDay: async (path) => days.get(path) ?? [], writeDay: async (path, rows) => void days.set(path, rows) }
  return { days, store }
}

describe("merging", () => {
  it("keeps one row per stable id", () => {
    expect(mergeRows([row("1", "2026-11-08")], [row("1", "2026-11-08"), row("2", "2026-11-08")]).map((item) => item.idEvent)).toEqual(["1", "2"])
  })
  it("never lets an empty field wipe a known one", () => {
    const merged = mergeRow(row("1", "2026-11-08", { strResult: "North won by 3 runs", intHomeScore: "100" }), row("1", "2026-11-08", { strResult: "", intHomeScore: null, strStatus: "FT" }))
    expect(merged).toMatchObject({ strResult: "North won by 3 runs", intHomeScore: "100", strStatus: "FT" })
  })
  it("files a game under the date the day feed uses", () => {
    expect(rowDate({ dateEvent: "2026-11-08", strTimestamp: "2026-11-09T01:00:00" })).toBe("2026-11-08")
    expect(rowDate({ strTimestamp: "2026-11-09T01:00:00" })).toBe("2026-11-09")
    expect(rowDate({ dateEvent: "soon" })).toBeNull()
  })
  it("drops images nobody reads and keeps what the adapters read", () => {
    const slim = slimRow(row("1", "2026-11-08", { strThumb: "t.png", strResult: "text" }) as RawEvent & Record<string, unknown>)
    expect(slim).toMatchObject({ strThumb: "t.png", strResult: "text" })
    expect(Object.keys(slimRow({ ...row("1", "2026-11-08"), strPoster: "p.png", strFilename: "f" } as RawEvent))).not.toContain("strPoster")
  })
})

describe("filing rows by day", () => {
  it("adds across leagues with no duplicates", async () => {
    const { days, store } = memoryStore()
    let index = await fileRows(cricket, [row("1", "2026-11-08"), row("2", "2026-11-09")], {}, store, NOW)
    index = await fileRows(cricket, [row("1", "2026-11-08", { strStatus: "FT" }), row("3", "2026-11-08", { idLeague: "9" })], index, store, NOW)
    expect(days.get(dayPath(cricket, "2026-11-08"))?.map((item) => item.idEvent)).toEqual(["1", "3"])
    expect(days.get(dayPath(cricket, "2026-11-08"))?.[0].strStatus).toBe("FT")
    expect(index).toMatchObject({ 1: "2026-11-08|4461", 3: "2026-11-08|9" })
  })
  it("moves a rescheduled game off its old day", async () => {
    const { days, store } = memoryStore()
    const index = await fileRows(cricket, [row("1", "2026-11-08")], {}, store, NOW)
    await fileRows(cricket, [row("1", "2026-11-12")], index, store, NOW)
    expect(days.get(dayPath(cricket, "2026-11-08"))).toEqual([])
    expect(days.get(dayPath(cricket, "2026-11-12"))?.map((item) => item.idEvent)).toEqual(["1"])
  })
  it("leaves out what is beyond the calendar window and forgets what fell out of it", async () => {
    const { days, store } = memoryStore()
    const index = await fileRows(cricket, [row("1", "2024-01-01")], { 9: "2024-01-01|1" }, store, NOW)
    expect(index).toEqual({})
    expect(days.size).toBe(0)
    expect(inCollectWindow("2026-10-10", NOW)).toBe(true)
    expect(inCollectWindow("2027-02-27", NOW)).toBe(true)
  })
})

describe("the rotation", () => {
  const leagues = Array.from({ length: 125 }, (_, index) => league(index))
  it("stays within the call limit", () => {
    expect(chooseLeagues(leagues, new Set(), NOW, TICK).length * 2 + RESULT_CALLS).toBeLessThanOrEqual(CALLS_PER_TICK)
  })
  it("reaches every league within a few ticks, leaving none out", () => {
    const seen = new Set<string>()
    for (let tick = 0; tick < 4; tick += 1) for (const item of chooseLeagues(leagues, new Set(), new Date(NOW.getTime() + tick * TICK), TICK)) seen.add(item.id)
    expect(seen.size).toBe(leagues.length)
  })
  it("gives leagues in play every tick without crowding out the rest", () => {
    const active = new Set(leagues.slice(0, 80).map((item) => item.id))
    const chosen = chooseLeagues(leagues, active, NOW, TICK)
    expect(chosen.slice(0, 20).every((item) => active.has(item.id))).toBe(true)
    expect(chosen.length).toBe(40)
    expect(new Set(chosen.map((item) => item.id)).size).toBe(40)
  })
  it("treats a game from yesterday to tomorrow as active", () => {
    expect([...activeLeagues([{ 1: "2026-11-06|10", 2: "2026-11-08|11", 3: "2026-11-20|12" }], NOW)].sort()).toEqual(["10", "11"])
  })
  it("reads the whole season for tennis, where nothing is listed ahead", () => {
    expect(leaguePaths({ id: "4464", sportId: "tennis" }, NOW)[0]).toBe("eventsseason.php?id=4464&s=2026")
    expect(leaguePaths({ id: "4461", sportId: "cricket" }, NOW)).toEqual(["eventsnextleague.php?id=4461", "eventspastleague.php?id=4461"])
  })
})

describe("asking for results", () => {
  const ended = (extra: Partial<RawEvent>) => row("1", "2026-11-06", extra)
  it("asks only for what has started and has no result", () => {
    expect(resultsWanted([ended({})], NOW)).toHaveLength(1)
    expect(resultsWanted([ended({ strResult: "text" }), ended({ resultRows: [{ strPlayer: "A" }] }), row("2", "2026-11-09")], NOW)).toEqual([])
  })
  it("leaves an empty answer alone for a while, then looks again", () => {
    expect(resultsWanted([ended({ resultsCheckedAt: NOW.getTime() - 3_600_000 })], NOW)).toEqual([])
    expect(resultsWanted([ended({ resultsCheckedAt: NOW.getTime() - 7 * 3_600_000 })], NOW)).toHaveLength(1)
  })
})

describe("next dates", () => {
  it("counts games per date, soonest first", () => {
    expect(nextDates({ 1: "2026-11-09|1", 2: "2026-11-09|2", 3: "2026-11-20|1", 4: "2026-11-01|1" }, "2026-11-07", 5)).toEqual([{ date: "2026-11-09", games: 2 }, { date: "2026-11-20", games: 1 }])
  })
})

describe("the league job", () => {
  const leagues = { leagues: [{ idLeague: "4461", strLeague: "Harbor Bash", strSport: "Cricket" }, { idLeague: "7000", strLeague: "AEW", strSport: "Fighting" }] }
  const respond = (handlers: Record<string, unknown>) =>
    vi.fn(async (url: string) => {
      const found = Object.entries(handlers).find(([part]) => url.includes(part))
      return new Response(JSON.stringify(found ? found[1] : { events: null }), { status: 200 })
    })

  beforeEach(() => {
    docs.clear()
    clearFeedCache()
    vi.stubEnv("THESPORTSDB_API_KEY", "paid")
    vi.useFakeTimers({ toFake: ["Date"], now: NOW })
  })

  it("makes a thin day complete, once, and offers the next date when the day has none", async () => {
    const upcoming = row("50", "2026-11-09", { strSeason: "2026-2027" })
    const finished = row("51", "2026-11-07", { strStatus: "FT", intHomeScore: "120", intAwayScore: "119" })
    const fetcher = respond({
      "all_leagues.php": leagues,
      "eventsnextleague.php?id=4461": { events: [upcoming] },
      "eventspastleague.php?id=4461": { events: [finished] },
      "eventsday.php?d=2026-11-07": { events: [finished] },
    })
    vi.stubGlobal("fetch", fetcher)

    await expect(collectLeagueEvents(TICK, NOW)).resolves.toMatchObject({ leagues: 1, calls: 2, events: 2 })
    // Scripted wrestling is not walked.
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("id=7000"))).toBe(false)

    expect((await getEvents({ date: "2026-11-09", sport: "cricket" })).events.map((event) => event.id)).toEqual(["tsdb-50"])
    const today = await getEvents({ date: "2026-11-07", sport: "cricket" })
    expect(today.events.map((event) => event.id)).toEqual(["tsdb-51"])
    expect(today.nextDates).toEqual([{ date: "2026-11-09", games: 1 }])
    expect((await storedEvents("2026-11-09", "cricket")).map((event) => event.id)).toEqual(["tsdb-50"])
  })

  it("fills a finished session with no result text from the results endpoint", async () => {
    const session = { idEvent: "70", idLeague: "4370", strLeague: "Harbor Series", strSport: "Motorsport", strEvent: "Harbor Grand Prix Practice 1", dateEvent: "2026-11-07", strTimestamp: "2026-11-07T08:00:00", strTime: "08:00:00", strTimeLocal: "09:00:00" }
    const fetcher = respond({
      "all_leagues.php": { leagues: [{ idLeague: "4370", strLeague: "Harbor Series", strSport: "Motorsport" }] },
      "eventspastleague.php?id=4370": { events: [session] },
      "eventresults.php?id=70": { results: [{ idPlayer: "9", strPlayer: "Ari Stone", intPosition: "1", intPoints: "0", strDetail: "1:11.717" }, { idPlayer: "8", strPlayer: "Ben Ash", intPosition: "2", strDetail: "+0.082s" }, { idPlayer: "7", strPlayer: "Cal Reed", intPosition: "3", strDetail: "+0.236s" }, { idPlayer: "6", strPlayer: "Dan Moss", intPosition: "22", strDetail: "DNF" }] },
    })
    vi.stubGlobal("fetch", fetcher)
    await expect(collectLeagueEvents(TICK, NOW)).resolves.toMatchObject({ calls: 3 })
    const [event] = (await getEvents({ date: "2026-11-07", sport: "motorsport" })).events
    expect(event).toMatchObject({ status: "finished", score: { kind: "classification", entries: [{ position: 1, name: "Ari Stone", time: "1:11.717", playerId: "9" }, { time: "+0.082" }, { time: "+0.236" }], out: [{ name: "Dan Moss", status: "DNF" }] } })
    fetcher.mockClear()
    await collectLeagueEvents(TICK, NOW)
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("eventresults.php"))).toBe(false)
  })

  it("stops at once when the circuit opens", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("all_leagues") ? new Response(JSON.stringify(leagues)) : new Response("", { status: 500 }))))
    const result = await collectLeagueEvents(TICK, NOW)
    expect(result).toMatchObject({ events: 0 })
  })

  it("does not spend the public test key", async () => {
    vi.stubEnv("THESPORTSDB_API_KEY", "")
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    await expect(collectLeagueEvents(TICK, NOW)).resolves.toEqual({ skipped: "feed_limited" })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("reads games far ahead from storage alone", async () => {
    const fetcher = respond({
      "all_leagues.php": leagues,
      "eventsnextleague.php?id=4461": { events: [row("60", "2027-02-20")] },
    })
    vi.stubGlobal("fetch", fetcher)
    await collectLeagueEvents(TICK, NOW)
    fetcher.mockClear()
    const feed = await getEvents({ date: "2027-02-20", sport: "cricket" })
    expect(feed.events.map((event) => event.id)).toEqual(["tsdb-60"])
    expect(fetcher).not.toHaveBeenCalled()
  })
})
