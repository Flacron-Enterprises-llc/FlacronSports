// Synthetic provider responses for isolated tests only.
import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/matches/route"
import { clearFeedCache, getEvents } from "@/lib/sports/service"

afterEach(() => {
  vi.unstubAllEnvs()
  clearFeedCache()
})

describe("frontend to backend contract", () => {
  it("the backend accepts the exact request the frontend sends", async () => {
    vi.stubEnv("API_ORIGIN", "https://backend.example")
    let sent = ""
    vi.stubGlobal("fetch", async (url: string) => {
      sent = url
      return new Response(JSON.stringify({ state: "ok", events: [] }), { status: 200 })
    })
    await getEvents({ date: "2026-11-06" })
    vi.unstubAllEnvs()
    expect(sent).toContain("/api/matches?")

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] }), { status: 200 }))
    const response = await GET(new Request(sent))
    expect(response.status).toBe(200)
  })

  it("returns a full day when the frontend asks for it", async () => {
    const events = Array.from({ length: 150 }, (_, index) => ({ idEvent: String(index), strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strSport: "Soccer", strStatus: "NS", strTimestamp: "2026-11-05T18:00:00" }))
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events }), { status: 200 }))
    const body = await (await GET(new Request("https://backend.example/api/matches?date=2026-11-05&sport=football&pageSize=500"))).json()
    expect(body.events).toHaveLength(150)
  })
})
