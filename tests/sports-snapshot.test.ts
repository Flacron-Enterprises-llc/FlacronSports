// Synthetic provider responses and an in-memory store for isolated tests only.
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

import { calendarDates } from "@/lib/jobs/tick"
import { clearFeedCache, getEvents } from "@/lib/sports/service"

const DAY = 86_400_000
const TICK = 15 * 60_000

const event = { idEvent: "1", strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strSport: "Soccer", strStatus: "NS", strTimestamp: "2026-11-05T18:00:00" }
const ok = () => new Response(JSON.stringify({ events: [event] }), { status: 200 })
const limited = () => new Response("", { status: 429 })
const request = { date: "2026-11-05", sport: "football" } as const

beforeEach(() => {
  docs.clear()
  clearFeedCache()
  vi.useRealTimers()
})

describe("feed snapshots", () => {
  it("lets visitors read the snapshot without calling the provider, even after a restart", async () => {
    vi.stubGlobal("fetch", async () => ok())
    await getEvents({ ...request, refresh: true })
    clearFeedCache()
    const fetcher = vi.fn(async () => ok())
    vi.stubGlobal("fetch", fetcher)
    const feed = await getEvents(request)
    expect(feed.state).toBe("ok")
    expect(feed.events).toHaveLength(1)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("keeps serving an old snapshot as stale while the provider refuses", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.stubGlobal("fetch", async () => ok())
    await getEvents({ ...request, refresh: true })
    clearFeedCache()
    vi.setSystemTime(Date.now() + 2 * 3_600_000)
    vi.stubGlobal("fetch", async () => limited())
    const feed = await getEvents(request)
    expect(feed.state).toBe("stale")
    expect(feed.events).toHaveLength(1)
  })

  it("refresh goes to the provider even with a fresh snapshot", async () => {
    vi.stubGlobal("fetch", async () => ok())
    await getEvents({ ...request, refresh: true })
    const fetcher = vi.fn(async () => ok())
    vi.stubGlobal("fetch", fetcher)
    await getEvents({ ...request, refresh: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

describe("calendar refresh", () => {
  const now = new Date("2026-11-06T12:00:00Z")
  const isoDay = (offset: number) => new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10)

  it("keeps tomorrow in every tick", () => {
    for (let tick = 0; tick < 8; tick++) expect(calendarDates(new Date(now.getTime() + tick * TICK))).toContain(isoDay(1))
  })

  it("covers a week each side of today within four ticks, wherever the rotation starts", () => {
    for (let start = 0; start < 12; start++) {
      const covered = new Set<string>()
      for (let tick = 0; tick < 4; tick++) for (const date of calendarDates(new Date(now.getTime() + (start + tick) * TICK))) covered.add(date)
      for (let offset = -7; offset <= 7; offset++) if (![-1, 0].includes(offset)) expect(covered).toContain(isoDay(offset))
    }
  })

  it("serves another day from a snapshot older than the near-today window", async () => {
    const other = { date: isoOffset(5), sport: "football" } as const
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.stubGlobal("fetch", async () => ok())
    await getEvents({ ...other, refresh: true })
    clearFeedCache()
    vi.setSystemTime(Date.now() + 90 * 60_000)
    const fetcher = vi.fn(async () => limited())
    vi.stubGlobal("fetch", fetcher)
    const feed = await getEvents(other)
    expect(feed.state).toBe("ok")
    expect(fetcher).not.toHaveBeenCalled()
  })
})

function isoOffset(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10)
}
