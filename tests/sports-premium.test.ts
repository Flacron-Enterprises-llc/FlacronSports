// Synthetic provider responses and an in-memory store for isolated tests only.
import { gunzipSync } from "node:zlib"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

import { calendarDates, listingTargets } from "@/lib/jobs/tick"
import { normalizeLineups, normalizeStats, normalizeTimeline } from "@/lib/sports/detail"
import { competitionRank, groupByCompetition, isMajorCompetition, pageOfGroups } from "@/lib/sports/priority"
import { clearFeedCache, getEvents, getMatchDetail, getStandings, getTeamFixtures, readSnapshot, writeSnapshot } from "@/lib/sports/service"
import { normalizeEvent, normalizeStatus } from "@/lib/sports/thesportsdb"
import type { SportEvent } from "@/lib/sports/types"

const raw = (id: string, league = "L", extra = {}) => ({ idEvent: id, strHomeTeam: "A", strAwayTeam: "B", strLeague: league, strSport: "Soccer", strStatus: "NS", strTimestamp: "2026-11-05T18:00:00", ...extra })
const event = (id: string, league: string, status: SportEvent["status"] = "scheduled") => normalizeEvent(raw(id, league, status === "live" ? { strStatus: "1H" } : {}), "football", new Date("2026-11-05T19:00:00Z"))
const today = () => new Date().toISOString().slice(0, 10)

beforeEach(() => {
  docs.clear()
  clearFeedCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("snapshots", () => {
  it("stores a day bigger than one Firestore document can hold", async () => {
    const data = { events: Array.from({ length: 1400 }, (_, index) => raw(String(index), "League ".repeat(200))) }
    expect(JSON.stringify(data).length).toBeGreaterThan(1_100_000)
    await writeSnapshot("big", data, 1)
    const [stored] = [...docs.values()]
    expect((stored.packed as Buffer).length).toBeLessThan(1_000_000)
    expect(JSON.parse(gunzipSync(stored.packed as Buffer).toString()).events).toHaveLength(1400)
    expect(await readSnapshot("big")).toEqual({ data, at: 1 })
  })

  it("still reads snapshots stored before compression", async () => {
    await writeSnapshot("old", {}, 1)
    const [id] = docs.keys()
    docs.set(id, { body: JSON.stringify({ events: [] }), at: 2 })
    expect(await readSnapshot("old")).toEqual({ data: { events: [] }, at: 2 })
  })
})

describe("provider requests", () => {
  it("stay out of the framework cache, which would log the key in the URL", async () => {
    let init: RequestInit | undefined
    vi.stubGlobal("fetch", async (_url: string, options?: RequestInit) => {
      init = options
      return new Response(JSON.stringify({ events: [] }), { status: 200 })
    })
    await getEvents({ date: today(), sport: "football", refresh: true })
    expect(init?.cache).toBe("no-store")
    expect(init).not.toHaveProperty("next")
  })
})

describe("live scores", () => {
  const stub = (live: unknown[]) => {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push(url)
      if (url.includes("/v2/json/livescore")) {
        expect((init?.headers as Record<string, string>)["X-API-KEY"]).toBe("paid")
        return new Response(JSON.stringify({ livescore: live }), { status: 200 })
      }
      return new Response(JSON.stringify({ events: [raw("1", "L", { strTimestamp: `${today()}T18:00:00` })] }), { status: 200 })
    })
    return calls
  }

  it("overlays the running score and clock, and polls once however many people ask", async () => {
    vi.stubEnv("THESPORTSDB_API_KEY", "paid")
    const calls = stub([{ idEvent: "1", intHomeScore: "2", intAwayScore: "1", strStatus: "2H", strProgress: "67" }])
    const first = await getEvents({ date: today(), sport: "football" })
    const second = await getEvents({ date: today(), sport: "football" })
    expect(first.events[0]).toMatchObject({ status: "live", clock: "67", score: { kind: "team", home: 2, away: 1 } })
    expect(second.events[0].status).toBe("live")
    expect(calls.filter((url) => url.includes("livescore"))).toHaveLength(1)
  })

  it("ignores a game the live feed has not started", async () => {
    vi.stubEnv("THESPORTSDB_API_KEY", "paid")
    stub([{ idEvent: "1", intHomeScore: null, intAwayScore: null, strStatus: "NS" }])
    expect((await getEvents({ date: today(), sport: "football" })).events[0].status).not.toBe("live")
  })

  it("keeps the stored games when the live feed fails", async () => {
    vi.stubEnv("THESPORTSDB_API_KEY", "paid")
    vi.stubGlobal("fetch", async (url: string) => url.includes("livescore") ? new Response("", { status: 500 }) : new Response(JSON.stringify({ events: [raw("1")] }), { status: 200 }))
    const feed = await getEvents({ date: today(), sport: "football" })
    expect(feed.events).toHaveLength(1)
    expect(feed.state).toBe("ok")
  })

  it("never calls the live feed on the free key", async () => {
    const calls = stub([])
    await getEvents({ date: today(), sport: "football" })
    expect(calls.some((url) => url.includes("livescore"))).toBe(false)
  })

  it("does not call a game live or upcoming long after it should have ended", () => {
    const now = new Date("2026-11-06T12:00:00Z")
    const old = "2026-11-05T13:00:00"
    expect(normalizeEvent(raw("1", "L", { strStatus: "2H", strTimestamp: old }), "football", now).status).toBe("unknown")
    const unstarted = normalizeEvent(raw("2", "L", { strStatus: "NS", intHomeScore: "0", intAwayScore: "0", strTimestamp: old }), "football", now)
    expect(unstarted).toMatchObject({ status: "unknown", score: { kind: "none" } })
    expect(normalizeEvent(raw("3", "L", { strStatus: "2H", strTimestamp: "2026-11-06T11:00:00" }), "football", now).status).toBe("live")
    expect(normalizeEvent(raw("4", "L", { strStatus: "FT", intHomeScore: "1", intAwayScore: "0", strTimestamp: old }), "football", now).status).toBe("finished")
  })

  it("recognises hockey periods and baseball innings as live", () => {
    for (const strStatus of ["P2", "IN2", "Q4", "1H"]) expect(normalizeStatus(raw("1", "L", { strStatus }))).toBe("live")
  })
})

describe("match detail", () => {
  it("orders the timeline and maps each kind of event", () => {
    const items = normalizeTimeline([
      { strTimeline: "Goal", strTimelineDetail: "Own Goal", intTime: "70", strHome: "No", strPlayer: "X" },
      { strTimeline: "Card", strTimelineDetail: "Yellow Card", intTime: "14", strHome: "Yes", strPlayer: "Y" },
      { strTimeline: "subst", strTimelineDetail: "Substitution 1", intTime: "60", strPlayer: "Z", strAssist: "W" },
      { strTimeline: "Unknown", intTime: "1" },
    ])
    expect(items.map((item) => [item.minute, item.kind, item.side])).toEqual([[14, "yellow", "home"], [60, "substitution", null], [70, "own-goal", "away"]])
    // Checked on 39 major games: the source names the player coming on second.
    expect([items[1].player, items[1].secondary]).toEqual(["W", "Z"])
  })

  it("keeps a real zero, drops a stat with no values, and leaves out unknown stats", () => {
    expect(normalizeStats([
      { strStat: "Shots on Goal", intHome: "0", intAway: "4" },
      { strStat: "Fouls", intHome: null, intAway: null },
      { strStat: "goals_prevented", intHome: "1", intAway: "1" },
    ])).toEqual([{ key: "shots on goal", home: "0", away: "4" }])
  })

  it("always writes percentages with the sign", () => {
    expect(normalizeStats([{ strStat: "Ball Possession", intHome: "58", intAway: "42%" }])).toEqual([{ key: "ball possession", home: "58%", away: "42%" }])
  })

  it("splits sides and puts the bench last", () => {
    const { home, away } = normalizeLineups([
      { strPlayer: "Bench", strHome: "Yes", strSubstitute: "Yes", strPosition: "Goalkeeper" },
      { strPlayer: "Striker", strHome: "Yes", strSubstitute: "No", strPosition: "Attacker", intSquadNumber: "9" },
      { strPlayer: "Keeper", strHome: "No", strSubstitute: "No", strPosition: "Goalkeeper" },
    ])
    expect(home.map((player) => player.name)).toEqual(["Striker", "Bench"])
    expect(home[0]).toMatchObject({ number: 9, group: "forward" })
    expect(away[0].group).toBe("goalkeeper")
  })

  it("reports a game with nothing published as empty, and a dead provider as unavailable", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ lineup: null, eventstats: null, timeline: null }), { status: 200 }))
    expect((await getMatchDetail(event("7", "L"))).state).toBe("empty")
    clearFeedCache()
    docs.clear()
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }))
    expect((await getMatchDetail(event("8", "L"))).state).toBe("unavailable")
  })

  it("does not call the provider again for a finished game already stored", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ timeline: [{ strTimeline: "Goal", strTimelineDetail: "Normal Goal", strPlayer: "X", intTime: "5" }] }), { status: 200 }))
    vi.stubGlobal("fetch", fetcher)
    const finished = normalizeEvent(raw("9", "L", { strStatus: "FT" }), "football")
    expect((await getMatchDetail(finished)).state).toBe("ok")
    const calls = fetcher.mock.calls.length
    await getMatchDetail(finished)
    expect(fetcher.mock.calls.length).toBe(calls)
  })
})

describe("grouping", () => {
  it("leads with competitions that have a live game, then the major ones", () => {
    const groups = groupByCompetition([event("1", "Zambia Super League"), event("2", "UEFA Champions League"), event("3", "Georgian Liga 3", "live"), event("4", "Andorran League")])
    expect(groups.map((group) => group.competition.name)).toEqual(["Georgian Liga 3", "UEFA Champions League", "Andorran League", "Zambia Super League"])
  })

  it("pages through every game exactly once", () => {
    const events = Array.from({ length: 130 }, (_, index) => event(String(index), `League ${index % 7}`))
    const groups = groupByCompetition(events)
    const seen = [1, 2, 3].flatMap((page) => pageOfGroups(groups, page, 60).flatMap((group) => group.events.map((item) => item.id)))
    expect(seen).toHaveLength(130)
    expect(new Set(seen).size).toBe(130)
    expect(pageOfGroups(groups, 4, 60)).toEqual([])
  })

  it("keeps Italian Serie A apart from Brazilian Serie A, and regional leagues out of the major list", () => {
    expect(competitionRank("Italian Serie A")).toBeLessThan(competitionRank("Brazilian Serie A"))
    expect(isMajorCompetition("Georgian Liga 3")).toBe(false)
  })
})

describe("paid schedule", () => {
  it("refreshes more of the calendar per run on the paid key", () => {
    const now = new Date("2026-11-06T12:00:00Z")
    const free = calendarDates(now).length
    const freeListings = listingTargets(now).length
    vi.stubEnv("THESPORTSDB_API_KEY", "paid")
    expect(calendarDates(now).length).toBeGreaterThan(free)
    expect(listingTargets(now).length).toBeGreaterThan(freeListings)
  })
})

describe("the frontend reaches the provider through the backend only", () => {
  it("asks the backend for standings and team fixtures", async () => {
    vi.stubEnv("API_ORIGIN", "https://backend.example")
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ state: "empty", rows: [], team: null, upcoming: [], recent: [], feed: {} }), { status: 200 })
    })
    await getStandings("4328")
    await getTeamFixtures("Arsenal", "football")
    expect(calls).toEqual(["https://backend.example/api/standings/4328", "https://backend.example/api/teams?name=Arsenal&sport=football"])
  })

  it("reports standings as unavailable when the backend fails, without trying the provider", async () => {
    vi.stubEnv("API_ORIGIN", "https://backend.example")
    const fetcher = vi.fn(async () => new Response("", { status: 500 }))
    vi.stubGlobal("fetch", fetcher)
    expect((await getStandings("4328")).state).toBe("unavailable")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
