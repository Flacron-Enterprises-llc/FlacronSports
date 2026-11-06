// Synthetic provider responses for isolated tests only.
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => ({ verifyIdToken: async () => ({ uid: "member" }) }), getAdminDb: () => null }))
vi.mock("@/lib/billing/firestore-store", () => ({ getEffectiveAccess: async () => ({ plan: "basic" }) }))

import { GET } from "@/app/api/matches/route"
import { clearFeedCache, getEvents, utcDate } from "@/lib/sports/service"

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
    await getEvents({ date: utcDate() })
    vi.unstubAllEnvs()
    expect(sent).toContain("/api/matches?")

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] }), { status: 200 }))
    const response = await GET(new Request(sent, { headers: { authorization: "Bearer member" } }))
    expect(response.status).toBe(200)
  })

  it("returns a full day when the frontend asks for it", async () => {
    const events = Array.from({ length: 150 }, (_, index) => ({ idEvent: String(index), strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strSport: "Soccer", strStatus: "NS", strTimestamp: "2026-11-05T18:00:00" }))
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events }), { status: 200 }))
    const body = await (await GET(new Request(`https://backend.example/api/matches?date=${utcDate()}&sport=football&pageSize=500`, { headers: { authorization: "Bearer member" } }))).json()
    expect(body.events).toHaveLength(150)
  })

  it("lets a sport filed by league open its next dates, and no other sport go that far", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] }), { status: 200 }))
    const far = utcDate(new Date(Date.now() + 100 * 86_400_000))
    const request = (sport: string) => new Request(`https://backend.example/api/matches?date=${far}&sport=${sport}`, { headers: { authorization: "Bearer member" } })
    expect((await GET(request("cricket"))).status).toBe(200)
    expect((await GET(request("football"))).status).toBe(400)
  })
})
