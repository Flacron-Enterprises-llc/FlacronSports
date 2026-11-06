// Synthetic tokens, cookies and backend replies for isolated tests only.
import { groupBroadcasts } from "@/components/video/broadcast-groups"
import { shellState } from "@/components/dashboard/paywall"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const plans: Record<string, string> = { paid: "basic", none: "none" }
let cookie: string | undefined
let cookieStoreFails = false

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => null,
  getAdminAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token === "bad") throw new Error("expired")
      return token === "staff" ? { uid: "staff", role: "editor" } : { uid: token }
    },
  }),
}))
vi.mock("@/lib/billing/firestore-store", () => ({ getEffectiveAccess: async (uid: string) => ({ plan: plans[uid] ?? "none" }), getUserPurchases: async (uid: string) => (uid === "addon" ? [{ unit: "export", expiresAtUTC: "2999-01-01T00:00:00Z", status: "active" }] : []) }))
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => {
    if (cookieStoreFails) throw new Error("cookies was called outside a request scope")
    return { get: (name: string) => (name === "fs_member" && cookie ? { value: cookie } : undefined) }
  },
}))

import { GET as matches } from "@/app/api/matches/route"
import { GET as match } from "@/app/api/matches/[id]/route"
import { GET as detail } from "@/app/api/matches/[id]/detail/route"
import { GET as viewing } from "@/app/api/matches/[id]/viewing-options/route"
import { GET as watch } from "@/app/api/watch/route"
import { GET as play } from "@/app/api/watch/play/route"
import { GET as standings } from "@/app/api/standings/[leagueId]/route"
import { GET as teams } from "@/app/api/teams/route"
import { GET as reports } from "@/app/api/reports/route"
import { GET as report } from "@/app/api/reports/[id]/route"
import { getPublishedReport, listPublishedReports } from "@/lib/content/reports"
import { claimRecovery, clearedMemberCookie, forgetRecovery, memberCookie } from "@/lib/member-cookie"
import { MemberAccessRequired } from "@/lib/member-fetch"
import { clearFeedCache, fromBackend, getEvent, getEvents, getStandings, getTeamFixtures } from "@/lib/sports/service"
import { config, middleware } from "@/middleware"
import { NextRequest } from "next/server"

const JWT = "aaa.bbb.ccc"
const id = { params: Promise.resolve({ id: "tsdb-1" }) }
const league = { params: Promise.resolve({ leagueId: "4328" }) }
const SECRET = "Arsenal 3 - 1 Chelsea"

const ROUTES: [string, (request: Request) => Promise<Response>][] = [
  ["/api/matches", matches],
  ["/api/matches/tsdb-1", (request) => match(request, id)],
  ["/api/matches/tsdb-1/detail", (request) => detail(request, id)],
  ["/api/matches/tsdb-1/viewing-options", (request) => viewing(request, id)],
  ["/api/watch", watch],
  ["/api/watch/play?match=tsdb-1", play],
  ["/api/standings/4328", (request) => standings(request, league)],
  ["/api/teams?name=Arsenal", teams],
  ["/api/reports", reports],
  ["/api/reports/some-report", (request) => report(request, id)],
]

const call = (path: string, token?: string) => new Request(`https://api.test${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })

beforeEach(() => {
  cookie = undefined
  cookieStoreFails = false
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  clearFeedCache()
})

describe("data routes on the backend", () => {
  it.each(ROUTES)("%s refuses no token, a dead token and no plan before touching data", async (path, handler) => {
    const provider = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", provider)
    expect((await handler(call(path))).status).toBe(401)
    expect((await handler(call(path, "bad"))).status).toBe(401)
    const refused = await handler(call(path, "none"))
    expect(refused.status).toBe(402)
    expect((await refused.json()).code).toBe("subscription_required")
    expect(provider).not.toHaveBeenCalled()
  })

  it.each(ROUTES)("%s lets a member and a staff account with no plan past the wall", async (path, handler) => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [], teams: [] })))
    for (const token of ["paid", "staff"]) expect([401, 402]).not.toContain((await handler(call(path, token))).status)
  })

  it("opens match data, and nothing else, to a live add-on the paywall lets through", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] })))
    expect((await match(call("/api/matches/tsdb-1", "addon"), id)).status).not.toBe(402)
    expect((await detail(call("/api/matches/tsdb-1/detail", "addon"), id)).status).not.toBe(402)
    expect((await viewing(call("/api/matches/tsdb-1/viewing-options", "addon"), id)).status).not.toBe(402)
    expect((await matches(call("/api/matches", "addon"))).status).toBe(402)
    expect((await reports(call("/api/reports", "addon"))).status).toBe(402)
  })

  it("counts the limit per account, not per address", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ table: [] })))
    const from = (token: string) => standings(new Request("https://api.test/api/standings/4328", { headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "9.9.9.9" } }), league)
    for (let index = 0; index < 60; index += 1) await from("limited")
    plans.limited = "basic"
    expect((await from("limited")).status).toBe(429)
    expect((await from("paid")).status).not.toBe(429)
    delete plans.limited
  })
})

describe("fromBackend during a page render", () => {
  const sent = () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ state: "ok", events: [], reports: [] })))
    vi.stubGlobal("fetch", fetcher)
    return fetcher
  }

  beforeEach(() => vi.stubEnv("API_ORIGIN", "https://backend.example"))

  it.each([
    ["sports", () => fromBackend("/api/matches")],
    ["reports", () => listPublishedReports("en")],
  ])("%s forwards the cookie and never uses the shared cache", async (_name, read) => {
    const fetcher = sent()
    cookie = JWT
    await read()
    const init = fetcher.mock.calls[0][1]
    expect(init.headers).toEqual({ Authorization: `Bearer ${JWT}` })
    expect(init.cache).toBe("no-store")
    expect(init).not.toHaveProperty("next")
  })

  it("sends no credential without a cookie, outside a request, or with a malformed value", async () => {
    const fetcher = sent()
    await fromBackend("/api/matches")
    cookie = "x\r\nInjected: 1"
    await fromBackend("/api/matches")
    cookie = JWT
    cookieStoreFails = true
    await fromBackend("/api/matches")
    for (const [, init] of fetcher.mock.calls) {
      expect(init).not.toHaveProperty("headers")
      expect(init.cache).toBe("no-store")
    }
  })

  it("stays out of the way when the backend runs the route itself", async () => {
    vi.unstubAllEnvs()
    const fetcher = sent()
    cookie = JWT
    expect(await fromBackend("/api/matches")).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe("a render the backend refuses", () => {
  beforeEach(() => vi.stubEnv("API_ORIGIN", "https://backend.example"))

  it.each([401, 402])("holds no data and no provider name after a %i", async (status) => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ code: "subscription_required", leak: SECRET }), { status }))
    const results = [await getEvents(), await getStandings("4328"), await getTeamFixtures("Arsenal"), await listPublishedReports("en")]
    expect(results.map((result) => ("feed" in result ? result.feed.state : result.state))).toEqual(["withheld", "withheld", "withheld", "withheld"])
    const text = JSON.stringify(results)
    expect(text).not.toContain("Arsenal 3")
    expect(text).not.toMatch(/thesportsdb/i)
  })

  it("is told apart from a missing game or report, so a member never sees a 404", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 402 }))
    await expect(getEvent("tsdb-1")).rejects.toBeInstanceOf(MemberAccessRequired)
    await expect(getPublishedReport("slug", "en")).rejects.toBeInstanceOf(MemberAccessRequired)
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 404 }))
    expect(await getEvent("tsdb-1")).toBeNull()
    expect(await getPublishedReport("slug", "en")).toBeNull()
  })

  it("renders the match and report pages without data, an error or a 404", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ event: { id: "tsdb-1", title: SECRET } }), { status: 402 }))
    // The project compiles JSX with Next, so this test supplies the classic runtime itself.
    vi.stubGlobal("React", await import("react"))
    const { default: MatchPage } = await import("@/app/[locale]/app/match/[id]/page")
    const { default: ReportPage } = await import("@/app/[locale]/app/news/[id]/page")
    const { MemberDataPending } = await import("@/components/dashboard/member-data-pending")
    const params = Promise.resolve({ locale: "en", id: "tsdb-1" })
    for (const element of [await MatchPage({ params }), await ReportPage({ params })]) {
      expect(element.type).toBe(MemberDataPending)
      expect(element.props).toEqual({})
    }
  }, 30_000)

  it("still reports a real outage as an outage", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }))
    expect((await getEvents()).state).toBe("unavailable")
    expect((await listPublishedReports("en")).state).toBe("unavailable")
  })
})

describe("the backend answers no pages", () => {
  const page = (path: string) => middleware(new NextRequest(`https://api.test${path}`))

  it("refuses page paths in the backend image only", () => {
    vi.stubEnv("BACKEND_ONLY", "true")
    expect(page("/app/scores").status).toBe(404)
    vi.unstubAllEnvs()
    expect(page("/app/scores").status).not.toBe(404)
  })

  it("covers locale paths with a dot, which the file rule would otherwise skip", () => {
    expect(config.matcher).toContain("/:locale(en|fr)/app/:path*")
  })
})

describe("the member cookie", () => {
  it("is short lived and scoped as designed", () => {
    expect(memberCookie(JWT, true)).toBe(`fs_member=${JWT}; Path=/; Max-Age=3600; SameSite=Lax; Secure`)
    expect(clearedMemberCookie(true)).toBe("fs_member=; Path=/; Max-Age=0; SameSite=Lax; Secure")
  })

  it("recovers once per page, so an empty render cannot loop", () => {
    expect(claimRecovery("/app/x", 1000)).toBe(true)
    expect(claimRecovery("/app/x", 2000)).toBe(false)
    expect(claimRecovery("/app/y", 2000)).toBe(true)
    expect(claimRecovery("/app/x", 62_000)).toBe(true)
    forgetRecovery("/app/x")
    expect(claimRecovery("/app/x", 62_001)).toBe(true)
  })
})

describe("the dashboard frame", () => {
  const base = { path: "/app", role: null, loaded: true, hasAccess: true, plan: "none" as const, addons: [] }

  it("shows no dashboard without a plan, on any product page", () => {
    for (const path of ["/app", "/app/scores", "/app/watch", "/app/news", "/app/compare", "/app/admin"]) expect(shellState({ ...base, path })).toBe("plans")
  })

  it("keeps paying and account pages reachable, with no dashboard around them", () => {
    for (const path of ["/app/billing", "/app/billing/invite/x", "/app/payment-success", "/app/settings", "/app/settings/security"]) expect(shellState({ ...base, path })).toBe("account")
  })

  it("confirms a payment outside the dashboard, even once the plan is active", () => {
    for (const plan of ["none", "basic", "premium"] as const) expect(shellState({ ...base, plan, path: "/app/payment-success" })).toBe("account")
    expect(shellState({ ...base, plan: "plus", path: "/app/payment-success", loaded: false })).toBe("account")
  })

  it("shows nothing of the dashboard until the plan is known", () => {
    expect(shellState({ ...base, loaded: false })).toBe("checking")
    expect(shellState({ ...base, plan: "premium", loaded: false })).toBe("checking")
  })

  it("does not ask a paying member to subscribe when the read fails", () => {
    expect(shellState({ ...base, hasAccess: false })).toBe("failed")
  })

  it("opens the dashboard for every plan and for staff", () => {
    for (const plan of ["basic", "plus", "premium"] as const) expect(shellState({ ...base, plan })).toBe("member")
    expect(shellState({ ...base, role: "admin" })).toBe("member")
  })
})

describe("TV listings", () => {
  const row = (channel: string, country: string | null) => ({ id: `${channel}${country}`, matchId: "m", eventName: "A v B", sportId: "football" as const, channel, country, logoUrl: null, startUTC: null })

  it("leads with the viewer's country and sorts channels within each", () => {
    const groups = groupBroadcasts([row("Z", "Spain"), row("B", "Pakistan"), row("A", "Pakistan"), row("C", null), row("D", "Iceland")], "Pakistan")
    expect(groups.map((group) => group.country)).toEqual(["Pakistan", "Iceland", "Spain", null])
    expect(groups[0].channels.map((item) => item.channel)).toEqual(["A", "B"])
  })

  it("lists a channel once, however many rows the feed repeats", () => {
    expect(groupBroadcasts([row("A", "Spain"), { ...row("A", "Spain"), id: "again" }], null)[0].channels).toHaveLength(1)
  })
})
