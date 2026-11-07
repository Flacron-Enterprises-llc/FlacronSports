// Spec pages 14 and 15. The rows mirror provider responses seen on 2026-11-07.
import { afterEach, describe, expect, it, vi } from "vitest"
import { PDFDocument } from "pdf-lib"
import { fakeDb } from "./fake-db"

const plans: Record<string, string> = { none: "none", basic: "basic", plus: "plus", premium: "premium" }

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => null,
  getAdminAuth: () => ({ verifyIdToken: async (token: string) => ({ uid: token, email_verified: true }) }),
}))
vi.mock("@/lib/billing/firestore-store", () => ({ getEffectiveAccess: async (uid: string) => ({ plan: plans[uid] ?? "none" }), getUserPurchases: async () => [] }))
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))

import { GET as cupsRoute } from "@/app/api/cups/[leagueId]/route"
import { GET as comparePlayersRoute } from "@/app/api/compare/players/route"
import { POST as exportRoute } from "@/app/api/exports/compare/route"
import { GET as motorsportRoute } from "@/app/api/motorsport/[leagueId]/route"
import { GET as playerRoute } from "@/app/api/players/[id]/route"
import { GET as playerSearchRoute } from "@/app/api/players/search/route"
import { exportComparison, renderComparisonPdf } from "@/lib/exports/service"
import { getDictionary } from "@/lib/i18n"
import { speechChunks, speechLang } from "@/lib/speech"
import type { Comparison, PlayerComparison } from "@/lib/sports/compare"
import { playerRows, playerSheet, teamSheet } from "@/lib/sports/compare-rows"
import { normalizeMoves, normalizePlayer } from "@/lib/sports/player"
import { knockoutRounds, previousSeason, raceWeekends } from "@/lib/sports/seasons"
import { clearFeedCache, getCupRounds, getRaceSchedule, normalizeStandings } from "@/lib/sports/service"
import type { RawEvent } from "@/lib/sports/thesportsdb"
import { standingZones } from "@/lib/sports/zones"

const en = getDictionary("en")
const call = (path: string, token?: string, init: RequestInit = {}) => new Request(`https://api.test${path}`, { ...init, headers: token ? { authorization: `Bearer ${token}` } : {} })
const league = (leagueId: string) => ({ params: Promise.resolve({ leagueId }) })
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

const session = (id: string, name: string, round: string, stamp: string, extra: Partial<RawEvent> = {}): RawEvent => ({ idEvent: id, strEvent: name, intRound: round, strTimestamp: stamp, strTime: stamp.slice(11), strSport: "Motorsport", ...extra })
const game = (id: string, round: number | string, date: string): RawEvent => ({ idEvent: id, intRound: round, strTimestamp: `${date}T20:00:00`, strTime: "20:00:00", strHomeTeam: `H${id}`, strAwayTeam: `A${id}`, strSport: "Soccer" })
const many = (prefix: string, round: number, size: number, date: string) => Array.from({ length: size }, (_, index) => game(`${prefix}${index}`, round, date))

/** A full cup draw from the round of 16, with league-phase weeks that must not appear. */
const wholeCup = [...many("w", 1, 18, "2025-09-16"), ...many("r", 16, 8, "2026-03-10"), ...many("q", 125, 4, "2026-04-07"), ...many("s", 150, 2, "2026-04-28"), ...many("t", 160, 1, "2026-05-02"), ...many("f", 200, 1, "2026-05-30")]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  clearFeedCache()
})

describe("qualification zones", () => {
  it("keeps the provider's text, trimmed, and null where it says nothing", () => {
    const { rows } = normalizeStandings([{ intRank: "1", strTeam: "A", strDescription: "Promotion - Champions League (League phase)" }, { intRank: "2", strTeam: "B", strDescription: " Qualifying" }, { intRank: "3", strTeam: "C", strDescription: "" }, { intRank: "4", strTeam: "D" }])
    expect(rows.map((row) => row.zone)).toEqual(["Promotion - Champions League (League phase)", "Qualifying", null, null])
  })

  it("builds a legend with places, in table order", () => {
    const rows = [["Relegation - Championship", 18], ["Relegation - Championship", 19], ["Champions League", 1], ["Champions League", 2], ["Europa League", 3], ["Champions League", 4], [null, 5]] as const
    const zones = standingZones(rows.map(([zone, rank]) => ({ zone, rank })))
    expect(zones).toEqual([
      { label: "Champions League", places: "1-2, 4", tone: "first" },
      { label: "Europa League", places: "3", tone: "second" },
      { label: "Relegation - Championship", places: "18-19", tone: "down" },
    ])
  })

  it("shows no legend for a table with no descriptions", () => {
    expect(standingZones([{ rank: 1, zone: null }])).toEqual([])
  })

  it("lists a place once when conference tables repeat it", () => {
    expect(standingZones([{ rank: 1, zone: "Play Offs" }, { rank: 1, zone: "Play Offs" }, { rank: 2, zone: "Play Offs" }])[0].places).toBe("1-2")
  })
})

describe("race weekends", () => {
  const now = new Date("2026-11-07T00:00:00Z")

  it("groups sessions by round and names them from the shared words", () => {
    const [weekend] = raceWeekends([
      session("3", "São Paulo Grand Prix", "20", "2026-11-08T17:00:00", { strCity: "São Paulo", strCountry: "Brazil" }),
      session("1", "São Paulo Grand Prix Practice 3", "20", "2026-11-07T14:30:00", { strVenue: "Interlagos Circuit", strCountry: "Brazil" }),
      session("2", "São Paulo Grand Prix Qualifying", "20", "2026-11-07T18:00:00"),
    ], now)
    expect(weekend).toMatchObject({ round: 20, name: "São Paulo Grand Prix", venue: "Interlagos Circuit", country: "Brazil", over: false })
    expect(weekend.sessions.map((item) => item.name)).toEqual(["Practice 3", "Qualifying", null])
  })

  it("keeps one-race rounds whole and round 0 events apart", () => {
    const weekends = raceWeekends([session("1", "Clash", "0", "2027-02-13T20:00:00"), session("2", "The Duel at Daytona", "0", "2027-02-18T20:00:00"), session("3", "Daytona 500", "1", "2027-02-21T20:00:00")], now)
    expect(weekends.map((item) => [item.name, item.round, item.sessions[0].name])).toEqual([["Clash", null, null], ["The Duel at Daytona", null, null], ["Daytona 500", 1, null]])
  })

  it("marks a midnight start as date only, not as a time", () => {
    const [weekend] = raceWeekends([session("1", "Jeddah ePrix", "1", "2026-12-18T00:00:00")], now)
    expect(weekend.sessions[0].dateOnly).toBe(true)
  })

  it("treats a weekend as over only when every session has passed", () => {
    const rows = [session("1", "Race Practice", "1", "2026-10-20T10:00:00"), session("2", "Race", "1", "2026-11-08T10:00:00")]
    expect(raceWeekends(rows, now)[0].over).toBe(false)
    expect(raceWeekends(rows.slice(0, 1), now)[0].over).toBe(true)
  })

  it("never carries a classification into the schedule", () => {
    const [weekend] = raceWeekends([session("1", "Monaco Grand Prix", "8", "2026-05-24T13:00:00", { strResult: "1. A\n2. B" })], now)
    expect(JSON.stringify(weekend)).not.toContain("position")
  })
})

describe("cup rounds", () => {
  it("names the knockout rounds and leaves the league phase out", () => {
    expect(knockoutRounds(wholeCup)?.map((round) => [round.key, round.games.length])).toEqual([["round16", 8], ["quarter", 4], ["semi", 2], ["third", 1], ["final", 1]])
  })

  it("refuses a feed with a final but no semi-finals", () => {
    expect(knockoutRounds(wholeCup.filter((row) => Number(row.intRound) !== 150))).toBeNull()
  })

  it("refuses a short round", () => {
    expect(knockoutRounds([...many("r", 16, 8, "2025-12-02"), ...many("q", 125, 1, "2026-02-10"), ...many("s", 150, 2, "2026-03-03"), ...many("f", 200, 1, "2026-05-23")])).toBeNull()
  })

  it("refuses unnumbered games dated inside the knockout stage", () => {
    expect(knockoutRounds([...wholeCup, game("x", 0, "2026-04-28")])).toBeNull()
  })

  it("allows unnumbered qualifiers before the knockout stage", () => {
    expect(knockoutRounds([...wholeCup, game("x", 0, "2025-08-01")])).not.toBeNull()
  })

  it("ignores a play-off block filed under the third-place code", () => {
    const rounds = knockoutRounds([...many("p", 160, 16, "2025-07-15"), ...many("r", 16, 8, "2025-08-11")])
    expect(rounds?.map((round) => round.key)).toEqual(["round16"])
  })

  it("has no rounds for a season still in its league phase", () => {
    expect(knockoutRounds(many("w", 3, 18, "2026-10-21"))).toBeNull()
  })

  it("steps back a season in both forms", () => {
    expect(previousSeason("2026-2027")).toBe("2025-2026")
    expect(previousSeason("2026")).toBe("2025")
    expect(previousSeason("next")).toBeNull()
  })
})

describe("season feeds", () => {
  const provider = (routes: Record<string, unknown>) =>
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const hit = Object.entries(routes).find(([path]) => url.includes(path))
      return reply(hit ? hit[1] : {})
    }))

  it("falls back to the last season when the new one has no knockouts", async () => {
    provider({
      "lookupleague.php?id=4480": { leagues: [{ strLeague: "UEFA Champions League", strSport: "Soccer", strCurrentSeason: "2026-2027" }] },
      "s=2026-2027": { events: many("w", 3, 18, "2026-10-21") },
      "s=2025-2026": { events: wholeCup },
    })
    const cup = await getCupRounds("4480")
    expect(cup).toMatchObject({ state: "ok", season: "2025-2026", competition: "UEFA Champions League" })
    expect(cup.items.at(-1)?.key).toBe("final")
    expect(cup.items.at(-1)?.games[0].id).toBe("tsdb-f0")
  })

  it("does not build rounds for a league outside the checked cups", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    expect((await getCupRounds("4329")).state).toBe("empty")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("says empty, not zero rounds, when neither season is whole", async () => {
    provider({ "lookupleague.php?id=4480": { leagues: [{ strLeague: "UEFA Champions League", strSport: "Soccer", strCurrentSeason: "2026-2027" }] }, "eventsseason": { events: many("w", 3, 18, "2026-10-21") } })
    expect((await getCupRounds("4480")).state).toBe("empty")
  })

  it("reports a provider failure as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })))
    expect((await getRaceSchedule("4370")).state).toBe("unavailable")
  })

  it("builds a schedule for a checked series", async () => {
    provider({ "lookupleague.php?id=4370": { leagues: [{ strLeague: "Formula 1", strSport: "Motorsport", strCurrentSeason: "2026" }] }, "eventsseason": { events: [session("1", "Qatar Grand Prix", "22", "2026-11-29T16:00:00")] } })
    const schedule = await getRaceSchedule("4370")
    expect(schedule).toMatchObject({ state: "ok", competition: "Formula 1", season: "2026" })
    expect(schedule.items[0].name).toBe("Qatar Grand Prix")
  })

  it("reads through the backend on Amplify and withholds when it refuses", async () => {
    vi.stubEnv("API_ORIGIN", "https://backend.test")
    const fetcher = vi.fn(async () => new Response("{}", { status: 402 }))
    vi.stubGlobal("fetch", fetcher)
    expect((await getRaceSchedule("4370")).state).toBe("withheld")
    expect((await getCupRounds("4480")).state).toBe("withheld")
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toBe("https://backend.test/api/motorsport/4370")
  })
})

describe("career moves", () => {
  const rows = [
    { idFormerTeam: "1", strFormerTeam: "FC Basel", strMoveType: "Permanent", strJoined: "2012", strDeparted: "2014" },
    { idFormerTeam: "2", strFormerTeam: "Roma", strMoveType: "Loan", strJoined: "2015", strDeparted: "2016" },
    { idFormerTeam: "3", strFormerTeam: "Egypt", strMoveType: "Permanent", strJoined: "2011", strDeparted: "2024" },
    { idFormerTeam: "4", strFormerTeam: "Real Madrid", strMoveType: "Permanent", strJoined: "2024", strDeparted: "" },
    { idFormerTeam: "5", strFormerTeam: "Coached Club", strMoveType: "Manager", strJoined: "2020", strDeparted: "2021" },
    { idFormerTeam: "6", strFormerTeam: "No Year", strMoveType: "Permanent", strJoined: "", strDeparted: "" },
  ]

  it("keeps dated club moves, newest first, and states no departure it was not given", () => {
    expect(normalizeMoves(rows, { idTeam2: "3" })).toEqual([
      { team: "Real Madrid", type: "permanent", joined: 2024, left: null },
      { team: "Roma", type: "loan", joined: 2015, left: 2016 },
      { team: "FC Basel", type: "permanent", joined: 2012, left: 2014 },
    ])
  })

  it("is empty when the provider has none", () => {
    expect(normalizeMoves(null, {})).toEqual([])
  })

  it("does not surface an undated status on the profile", () => {
    const profile = normalizePlayer({ idPlayer: "1", strPlayer: "A", strSport: "Soccer", strWage: "€1", strSide: "Left" }, () => "football")
    expect(JSON.stringify(profile)).not.toContain("€1")
    expect(profile).not.toHaveProperty("status")
  })
})

const stubPlayers = () =>
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const id = /id=(\d+)/.exec(url)?.[1]
    if (url.includes("lookupformerteams")) return reply({ formerteams: [{ idFormerTeam: "9", strFormerTeam: "Monaco", strMoveType: "Youth", strJoined: "2013", strDeparted: "2015" }] })
    if (url.includes("searchplayers")) return reply({ player: [{ idPlayer: "1", strPlayer: "One", strTeam: "Club", strSport: "Soccer", strWage: "€9" }] })
    if (id === "404") return reply({ players: null })
    return reply({ players: [{ idPlayer: id, strPlayer: `Player ${id}`, strTeam: "Club", strSport: "Soccer", strPosition: "Forward", strSide: "Left", strBirthLocation: "Paris", strWage: "€9", strHeight: null }] })
  }))

describe("player comparison", () => {
  const compare = (token: string | undefined, query = "first=1&second=2") => comparePlayersRoute(call(`/api/compare/players?${query}`, token))

  it("refuses no token, no plan and Basic on the server", async () => {
    expect((await compare(undefined)).status).toBe(401)
    expect((await compare("none")).status).toBe(402)
    expect((await compare("basic")).status).toBe(403)
  })

  it("gives Plus no advanced fields, not even in the reply", async () => {
    stubPlayers()
    const response = await compare("plus")
    const text = await response.clone().text()
    expect(response.status).toBe(200)
    expect(text).not.toContain("€9")
    expect(text).not.toContain("Paris")
    expect(((await response.json()) as PlayerComparison).tier).toBe("basic")
  })

  it("gives Premium the advanced fields", async () => {
    stubPlayers()
    const body = (await (await compare("premium")).json()) as PlayerComparison
    expect(body.players[0].advanced).toEqual({ side: "Left", birthplace: "Paris", wage: "€9" })
  })

  it("refuses the same player twice, a bad id and an unknown player", async () => {
    stubPlayers()
    expect((await compare("plus", "first=1&second=1")).status).toBe(400)
    expect((await compare("plus", "first=x&second=2")).status).toBe(400)
    expect((await compare("plus", "first=1&second=404")).status).toBe(404)
  })

  it("drops a row nobody has and dashes a one-sided gap", () => {
    const profile = { id: "1", name: "A", sportId: "football" as const, team: "X", position: null, nationality: null, born: null, number: null, height: null, weight: null }
    const rows = playerRows({ tier: "basic", players: [{ profile }, { profile: { ...profile, team: null, height: "1.80 m" } }], fetchedAt: "" }, en, "en")
    expect(rows.find(([label]) => label === en.discover.team)).toEqual([en.discover.team, "X", "–"])
    expect(rows.find(([label]) => label === en.discover.height)).toEqual([en.discover.height, "–", "1.80 m"])
    expect(rows.some(([label]) => label === en.discover.position)).toBe(false)
  })

  it("searches players for a plan holder only, without advanced fields", async () => {
    stubPlayers()
    expect((await playerSearchRoute(call("/api/players/search?q=one", "none"))).status).toBe(402)
    const response = await playerSearchRoute(call("/api/players/search?q=one", "plus"))
    expect(await response.json()).toEqual({ players: [{ id: "1", name: "One", team: "Club" }] })
  })
})

describe("player page moves", () => {
  it("ships dated moves with the profile and survives their failure", async () => {
    stubPlayers()
    const route = () => playerRoute(call("/api/players/1", "basic"), { params: Promise.resolve({ id: "1" }) })
    const body = (await (await route()).json()) as { career: { moves: unknown[]; checkedAt: string } }
    expect(body.career.moves).toEqual([{ team: "Monaco", type: "youth", joined: 2013, left: 2015 }])
    expect(body.career.checkedAt).toMatch(/^\d{4}-/)
    clearFeedCache()
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("lookupformerteams") ? new Response("", { status: 500 }) : reply({ players: [{ idPlayer: "1", strPlayer: "A", strSport: "Soccer" }] }))))
    const after = (await (await route()).json()) as { player: unknown; career: unknown }
    expect(after.player).toBeTruthy()
    expect(after.career).toBeNull()
  })
})

describe("comparison export", () => {
  const purchase = { uid: "u", unit: "export", sku: "export_pack", purchaseId: "p", allowance: 10, consumed: 0, status: "active", validFromUTC: "2026-11-01T00:00:00.000Z", expiresAtUTC: "2026-12-01T00:00:00.000Z" }
  const now = new Date("2026-11-07T00:00:00Z")
  const sheet = { title: "A / B", measure: "Measure", names: ["A", "B"] as [string, string], rows: [["Form", "W", "L"] as [string, string, string]], notes: ["Note"], footer: "Footer" }

  it("spends one credit only after the file exists", async () => {
    const { db, docs, put } = fakeDb()
    put("billing_purchases/p", purchase)
    await expect(exportComparison(db, { uid: "u", load: async () => { throw new Error("provider down") }, render: renderComparisonPdf }, now)).rejects.toThrow("provider down")
    await expect(exportComparison(db, { uid: "u", load: async () => sheet, render: async () => { throw new Error("render failed") } }, now)).rejects.toThrow("render failed")
    expect(docs.get("billing_purchases/p")?.consumed).toBe(0)
    await exportComparison(db, { uid: "u", load: async () => sheet, render: renderComparisonPdf }, now)
    expect(docs.get("billing_purchases/p")?.consumed).toBe(1)
  })

  it("refuses with no credit before doing any work", async () => {
    const { db } = fakeDb()
    const load = vi.fn(async () => sheet)
    await expect(exportComparison(db, { uid: "u", load, render: renderComparisonPdf }, now)).rejects.toMatchObject({ code: "allowance_exhausted" })
    expect(load).not.toHaveBeenCalled()
  })

  it("renders a real one-page PDF, including names outside Latin-1", async () => {
    const bytes = await renderComparisonPdf({ ...sheet, names: ["Ślepsk Suwałki", "Élan Béarnais"], title: "Ślepsk Suwałki / Élan Béarnais" })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it("holds Plus to the basic rows in the file too", () => {
    const record = { played: 2, wins: 1, draws: 0, losses: 1, ties: 0, noResults: 0, counted: 2, scored: 3, conceded: 2 }
    const team = { name: "A", record, form: ["W", "L"] as ("W" | "L")[], next: null }
    const basic: Comparison = { tier: "basic", sportId: "football", teams: [team, { ...team, name: "B" }], headToHead: [], fetchedAt: "" }
    const labels = teamSheet(basic, en).rows.map(([label]) => label)
    expect(labels).toContain(en.compare.record)
    expect(labels).not.toContain(en.compare.homeRecord)
    const facts: PlayerComparison = { tier: "basic", players: [{ profile: { id: "1", name: "A", sportId: "football", team: "X", position: null, nationality: null, born: null, number: null, height: null, weight: null } }, { profile: { id: "2", name: "B", sportId: "football", team: "Y", position: null, nationality: null, born: null, number: null, height: null, weight: null } }], fetchedAt: "" }
    expect(playerSheet(facts, en, "en").rows.map(([label]) => label)).not.toContain(en.compare.wage)
  })

  it("writes French when asked", () => {
    const fr = getDictionary("fr")
    expect(fr.compare.exportPdf).not.toBe(en.compare.exportPdf)
    expect(fr.cups.rounds.final).toBe("Finale")
  })

  it("keeps the route behind the same gates as the screen", async () => {
    const post = (token?: string) => exportRoute(call("/api/exports/compare", token, { method: "POST", body: JSON.stringify({ mode: "players", first: "1", second: "2" }) }))
    expect((await post()).status).toBe(401)
    expect((await post("none")).status).toBe(402)
    expect((await post("basic")).status).toBe(403)
  })
})

describe("data routes", () => {
  const routes: [string, (token?: string) => Promise<Response>][] = [
    ["motorsport", (token) => motorsportRoute(call("/api/motorsport/4370", token), league("4370"))],
    ["cups", (token) => cupsRoute(call("/api/cups/4480", token), league("4480"))],
  ]

  it.each(routes)("%s needs a token and a plan, and reads nothing without them", async (_, route) => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    expect((await route()).status).toBe(401)
    expect((await route("none")).status).toBe(402)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe("audio summaries", () => {
  it("splits a long report at sentence ends without losing text", () => {
    const sentence = "Arsenal beat Chelsea in a close game at home on Saturday afternoon. "
    const chunks = speechChunks(sentence.repeat(12))
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 220)).toBe(true)
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(sentence.repeat(12).trim())
  })

  it("has nothing to say for empty text", () => {
    expect(speechChunks("  \n ")).toEqual([])
  })

  it("follows the page language", () => {
    expect(speechLang("fr")).toBe("fr-FR")
    expect(speechLang("en")).toBe("en-US")
  })
})
