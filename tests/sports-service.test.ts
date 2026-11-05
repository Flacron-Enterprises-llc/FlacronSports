// Synthetic provider responses for isolated tests only.
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

import { ApiError } from "@/lib/api-auth"
import { clearFeedCache, getEvent, getEvents } from "@/lib/sports/service"

const event = (id: string) => ({ idEvent: id, strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strSport: "Soccer", strStatus: "NS", strTimestamp: "2026-11-05T18:00:00" })
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const limited = () => new Response("", { status: 429 })

beforeEach(() => {
  clearFeedCache()
  vi.useRealTimers()
})

describe("provider feed", () => {
  it("makes calls one at a time", async () => {
    let active = 0
    let peak = 0
    vi.stubGlobal("fetch", async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
      return ok({ events: [] })
    })
    await getEvents({ date: "2026-11-05" })
    expect(peak).toBe(1)
  })

  it("serves a repeat request from memory", async () => {
    const fetcher = vi.fn(async () => ok({ events: [event("1")] }))
    vi.stubGlobal("fetch", fetcher)
    await getEvents({ date: "2026-11-05", sport: "football" })
    await getEvents({ date: "2026-11-05", sport: "football" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("keeps the last good data and labels it stale when rate limited", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.stubGlobal("fetch", async () => ok({ events: [event("1")] }))
    await getEvents({ date: "2026-11-05", sport: "football" })
    vi.setSystemTime(Date.now() + 10 * 60_000)
    vi.stubGlobal("fetch", async () => limited())
    const feed = await getEvents({ date: "2026-11-05", sport: "football" })
    expect(feed.state).toBe("stale")
    expect(feed.events).toHaveLength(1)
  })

  it("reports unavailable instead of inventing data", async () => {
    vi.stubGlobal("fetch", async () => limited())
    const feed = await getEvents({ date: "2026-11-05", sport: "football" })
    expect(feed.state).toBe("unavailable")
    expect(feed.events).toEqual([])
  })

  it("answers a rate-limited lookup from the daily feed in memory", async () => {
    vi.stubGlobal("fetch", async () => ok({ events: [event("7")] }))
    await getEvents({ date: "2026-11-05", sport: "football" })
    vi.stubGlobal("fetch", async () => limited())
    expect((await getEvent("tsdb-7"))?.id).toBe("tsdb-7")
  })

  it("turns a failed match lookup into a 503", async () => {
    vi.stubGlobal("fetch", async () => limited())
    await expect(getEvent("tsdb-1")).rejects.toBeInstanceOf(ApiError)
    await expect(getEvent("tsdb-1")).rejects.toMatchObject({ status: 503 })
  })
})
