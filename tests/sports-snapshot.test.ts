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

import { clearFeedCache, getEvents } from "@/lib/sports/service"

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
