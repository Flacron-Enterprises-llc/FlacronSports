// Synthetic stored feeds, one per sport, shaped like the provider's rows. Isolated tests only.
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
vi.mock("@/lib/sports/coverage", () => ({ coverageRules: async () => ({}), sportAllowed: () => true, eventAllowed: () => true, videoAllowed: () => true }))

import { clearFeedCache, utcDate, writeSnapshot } from "@/lib/sports/service"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { getWatchFeed, takeTurns, type WatchFeed } from "@/lib/video/catalog"
import { cricketFormat, splitSession, splitTennisTitle, SPORT_FACETS, type FacetKey } from "@/lib/video/facets"
import { clearClipCache } from "@/lib/video/scorebat"

const now = new Date()
const tomorrow = new Date(now.getTime() + 86_400_000)
const soon = new Date(now.getTime() + 3_600_000).toISOString()
const later = new Date(now.getTime() + 26 * 3_600_000).toISOString()
const past = new Date(now.getTime() - 5 * 3_600_000).toISOString()

interface Row { idEvent: string; [key: string]: unknown }

const game = (id: string, sport: string, league: string, home: string, away: string, extra: Partial<Row> = {}): Row => ({
  idEvent: id, strSport: sport, strLeague: league, idLeague: league, strEvent: `${home} vs ${away}`, strHomeTeam: home, strAwayTeam: away, strTimestamp: past, strStatus: "FT", intHomeScore: "1", intAwayScore: "0", ...extra,
})
const video = (id: string) => `https://www.youtube.com/watch?v=${id.padStart(11, "a")}`

// Today's games, tomorrow's games, and today's listings for each sport.
const FIXTURES: Record<SportId, { today: Row[]; next: Row[]; listings: [string, string][] }> = {
  football: {
    today: [game("100", "Soccer", "English Premier League", "Arsenal", "Chelsea", { strVideo: video("100") })],
    next: [game("101", "Soccer", "Spanish La Liga", "Girona", "Sevilla", { strTimestamp: later, strStatus: "NS" })],
    listings: [["101", "Girona vs Sevilla"]],
  },
  basketball: {
    today: [game("200", "Basketball", "NBA", "Boston Celtics", "Miami Heat", { strVideo: video("200") }), game("202", "Basketball", "EuroLeague Basketball", "Baskonia", "Fenerbahce", { strStatus: "Q3", strTimestamp: new Date(now.getTime() - 3_600_000).toISOString() })],
    next: [game("201", "Basketball", "NBA", "Detroit Pistons", "Orlando Magic", { strTimestamp: later, strStatus: "NS" })],
    listings: [["201", "Detroit Pistons vs Orlando Magic"]],
  },
  "american-football": {
    today: [game("300", "American Football", "NFL", "Buffalo Bills", "New York Jets", { strVideo: video("300") })],
    next: [game("301", "American Football", "NCAA Division 1", "Army", "Navy", { strTimestamp: later, strStatus: "NS" })],
    listings: [["301", "Army vs Navy"]],
  },
  baseball: {
    today: [game("400", "Baseball", "MLB", "New York Yankees", "Boston Red Sox", { strVideo: video("400") })],
    next: [game("401", "Baseball", "Japanese NPB", "Hanshin Tigers", "Yomiuri Giants", { strTimestamp: later, strStatus: "NS" })],
    listings: [["401", "Hanshin Tigers vs Yomiuri Giants"]],
  },
  "ice-hockey": {
    today: [game("500", "Ice Hockey", "NHL", "Buffalo Sabres", "Ottawa Senators", { strVideo: video("500") })],
    next: [game("501", "Ice Hockey", "KHL", "CSKA Moscow", "SKA", { strTimestamp: later, strStatus: "NS" })],
    listings: [["501", "CSKA Moscow vs SKA"]],
  },
  tennis: {
    today: [{ idEvent: "600", strSport: "Tennis", strLeague: "ATP World Tour", strEvent: "Swiss Indoors Fritz vs Vacherot", strDescriptionEN: "Swiss Indoors - Basel\r\nFritz (1) vs Vacherot", strTimestamp: past, strVideo: video("600") }],
    next: [{ idEvent: "601", strSport: "Tennis", strLeague: "WTA Tour", strEvent: "Vienna Open de Minaur vs Mannarino", strTimestamp: later }],
    listings: [["601", "Vienna Open de Minaur vs Mannarino"]],
  },
  cricket: {
    today: [game("700", "Cricket", "Twenty20 International Series", "New Zealand Cricket", "India Cricket", { strVideo: video("700") })],
    next: [game("701", "Cricket", "ICC World Test Championship", "Bangladesh Cricket", "West Indies Cricket", { strTimestamp: later, strStatus: "" }), game("702", "Cricket", "Australian Big Bash League", "Sydney Sixers", "Perth Scorchers", { strTimestamp: later, strStatus: "" })],
    listings: [["701", "Bangladesh Cricket vs West Indies Cricket"]],
  },
  rugby: {
    today: [game("800", "Rugby", "English Premiership Rugby", "Bath", "Saracens", { strVideo: video("800") })],
    next: [game("801", "Rugby", "Six Nations", "France", "Ireland", { strTimestamp: later, strStatus: "NS" })],
    listings: [["801", "France vs Ireland"]],
  },
  volleyball: {
    today: [game("900", "Volleyball", "Italian Volleyball League", "Perugia", "Trento", { strVideo: video("900") })],
    next: [game("901", "Volleyball", "Polish PlusLiga", "Jastrzebski", "Resovia", { strTimestamp: later, strStatus: "NS" })],
    listings: [["901", "Jastrzebski vs Resovia"]],
  },
  "combat-sports": {
    today: [{ idEvent: "1000", strSport: "Fighting", strLeague: "UFC", strEvent: "UFC 333 Pereira vs Ankalaev", strTimestamp: past, strVideo: video("1000") }],
    next: [
      { idEvent: "1001", strSport: "Fighting", strLeague: "Boxing", strEvent: "Joshua Buatsi vs Willy Hutchinson", strTimestamp: later },
      { idEvent: "1002", strSport: "Fighting", strLeague: "WWE", strEvent: "RAW #1745", strTimestamp: later },
    ],
    listings: [["1001", "Joshua Buatsi vs Willy Hutchinson"], ["1002", "RAW #1745"]],
  },
  motorsport: {
    today: [{ idEvent: "1100", strSport: "Motorsport", strLeague: "Formula 1", strEvent: "São Paulo Grand Prix Qualifying", strTimestamp: past, strVideo: video("1100") }],
    next: [{ idEvent: "1101", strSport: "Motorsport", strLeague: "Formula 1", strEvent: "São Paulo Grand Prix", strTimestamp: later }, { idEvent: "1102", strSport: "Motorsport", strLeague: "MotoGP", strEvent: "Valencia Grand Prix Sprint", strTimestamp: later }],
    listings: [["1101", "São Paulo Grand Prix"], ["1102", "Valencia Grand Prix Sprint"]],
  },
}

async function store(sport: SportId, override?: Partial<(typeof FIXTURES)[SportId]>) {
  const key = SPORTS.find((item) => item.id === sport)?.providerKey as string
  const { today, next, listings } = { ...FIXTURES[sport], ...override }
  const path = (file: string, date: Date) => `${file}?${new URLSearchParams({ d: utcDate(date), s: key })}`
  const at = Date.now() - 60_000
  await writeSnapshot(path("eventsday.php", now), { events: today }, at)
  await writeSnapshot(path("eventsday.php", tomorrow), { events: next }, at)
  await writeSnapshot(path("eventstv.php", now), { tvevents: listings.map(([id, name]) => ({ id: `tv-${id}`, idEvent: id, strSport: key, strEvent: name, strChannel: "Channel One", strCountry: "France", strTimeStamp: soon })) }, at)
}

async function storeAll() {
  for (const { id } of SPORTS) await store(id)
}

const count = (feed: WatchFeed) => feed.highlights.length + feed.clips.length + feed.live.length + feed.broadcasts.length

beforeEach(() => {
  docs.clear()
  clearFeedCache()
  clearClipCache()
  // Every checked video comes from an approved channel unless a test says otherwise.
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ author_name: "Official", author_url: "https://www.youtube.com/@NBA" }), { status: 200 }))
})

describe("each sport's own filters", () => {
  it.each(SPORTS.map((sport) => sport.id))("%s offers only its own filters, and competition always", async (sport) => {
    await store(sport)
    const feed = await getWatchFeed(sport, now)
    const keys = feed.facets?.map((facet) => facet.key) ?? []
    expect(keys).toContain("competition")
    for (const key of keys) expect(SPORT_FACETS[sport]).toContain(key)
  })

  it.each(SPORTS.map((sport) => sport.id))("no %s option gives an empty list", async (sport) => {
    await store(sport)
    const feed = await getWatchFeed(sport, now)
    const options = (feed.facets ?? []).flatMap(({ key, options: names }) => names.map((name) => ({ key, name })))
    expect(options.length).toBeGreaterThan(0)
    for (const { key, name } of options) expect(count(await getWatchFeed(sport, now, { [key]: name })), `${key}=${name}`).toBeGreaterThan(0)
  })

  it.each(SPORTS.map((sport) => sport.id))("every %s option still returns something inside another filter", async (sport) => {
    await store(sport)
    const first = await getWatchFeed(sport, now)
    for (const { key, options } of first.facets ?? []) {
      const narrowed = await getWatchFeed(sport, now, { [key]: options[0] })
      for (const other of narrowed.facets ?? []) {
        for (const name of other.options) expect(count(await getWatchFeed(sport, now, { [key]: options[0], [other.key]: name })), `${key}+${other.key}=${name}`).toBeGreaterThan(0)
      }
    }
  })

  it("reads the right values for each kind of sport", async () => {
    await storeAll()
    const options = async (sport: SportId, key: FacetKey) => (await getWatchFeed(sport, now)).facets?.find((facet) => facet.key === key)?.options
    expect(await options("basketball", "team")).toEqual(expect.arrayContaining(["Boston Celtics", "Detroit Pistons", "Baskonia"]))
    expect(await options("tennis", "tournament")).toEqual(["Swiss Indoors", "Vienna Open"])
    expect(await options("tennis", "athlete")).toEqual(expect.arrayContaining(["Fritz", "Vacherot", "de Minaur", "Mannarino"]))
    expect(await options("combat-sports", "athlete")).toEqual(expect.arrayContaining(["Pereira", "Ankalaev", "Joshua Buatsi"]))
    expect(await options("motorsport", "race")).toEqual(["São Paulo Grand Prix", "Valencia Grand Prix"])
    expect(await options("motorsport", "session")).toEqual(["Qualifying", "Race", "Sprint"])
    expect(await options("cricket", "format")).toEqual(["T20", "Test"])
    expect(await options("cricket", "series")).toEqual(["Bangladesh vs West Indies", "India vs New Zealand"])
  })

  it("does not offer a team where a sport has none, or an athlete in a team sport", async () => {
    await store("tennis")
    await store("basketball")
    expect((await getWatchFeed("tennis", now)).facets?.map((facet) => facet.key)).not.toContain("team")
    expect((await getWatchFeed("basketball", now)).facets?.map((facet) => facet.key)).not.toContain("athlete")
  })

  it("matches a chosen team exactly, so one name never pulls in a longer one", async () => {
    await store("football", { today: [game("110", "Soccer", "Italian Serie A", "Inter", "Milan", { strVideo: video("110") }), game("111", "Soccer", "American Major League Soccer", "Inter Miami", "LAFC", { strVideo: video("111") })], next: [], listings: [] })
    expect((await getWatchFeed("football", now, { team: "Inter" })).highlights.map((item) => item.title)).toEqual(["Inter vs Milan"])
    expect((await getWatchFeed("football", now, { q: "inter" })).highlights).toHaveLength(2)
  })

  it("files a listing under its competition even when the game is tomorrow", async () => {
    await store("basketball")
    const feed = await getWatchFeed("basketball", now, { competition: "NBA" })
    expect(feed.broadcasts.map((item) => item.matchId)).toEqual(["tsdb-201"])
  })

  it("leaves a listing out of the options once only video is wanted", async () => {
    await store("football")
    const feed = await getWatchFeed("football", now, { watchable: true })
    expect(feed.broadcasts).toEqual([])
    expect(feed.facets?.find((facet) => facet.key === "competition")?.options).toEqual(["English Premier League"])
  })

  it("does not build an option from a video that fails the channel check", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ author_name: "Fan", author_url: "https://www.youtube.com/@somefan" }), { status: 200 }))
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    await store("rugby", { today: [game("810", "Rugby", "Six Nations", "Wales", "Italy", { strVideo: video("810") })], next: [], listings: [] })
    const feed = await getWatchFeed("rugby", now)
    expect(feed.highlights).toEqual([])
    expect(feed.facets).toEqual([])
  })
})

describe("what shows under each sport", () => {
  it.each(SPORTS.map((sport) => sport.id).filter((id) => id !== "football"))("%s shows its own video and listing, and no football clip", async (sport) => {
    await storeAll()
    await writeSnapshot("scorebat:feed", [{ id: "clip1", title: "Arsenal - Chelsea", competition: "ENGLAND: Premier League", thumbnailUrl: null, dateUTC: past, embedUrl: "https://www.scorebat.com/embed/v/x/" }], Date.now())
    const feed = await getWatchFeed(sport, now)
    expect(feed.clips).toEqual([])
    expect(feed.highlights.length).toBeGreaterThan(0)
    expect(feed.highlights.every((item) => item.sportId === sport)).toBe(true)
    expect(feed.broadcasts.length).toBeGreaterThan(0)
    expect(feed.broadcasts.every((item) => item.sportId === sport)).toBe(true)
  })

  it("shows football clips under football with team and competition options", async () => {
    await store("football")
    await writeSnapshot("scorebat:feed", [{ id: "clip1", title: "Lyon - Metz", competition: "FRANCE: Ligue 1", thumbnailUrl: null, dateUTC: past, embedUrl: "https://www.scorebat.com/embed/v/x/" }], Date.now())
    const feed = await getWatchFeed("football", now, { team: "Metz" })
    expect(feed.clips.map((item) => item.title)).toEqual(["Lyon - Metz"])
    expect(feed.highlights).toEqual([])
  })

  it("keeps scripted shows out of combat listings", async () => {
    await store("combat-sports")
    const feed = await getWatchFeed("combat-sports", now)
    expect(feed.broadcasts.map((item) => item.eventName)).toEqual(["Joshua Buatsi vs Willy Hutchinson"])
  })

  it("keeps one big game from filling the listings", async () => {
    await store("basketball")
    const key = `eventstv.php?${new URLSearchParams({ d: utcDate(now), s: "Basketball" })}`
    const rows = (id: string, name: string) => Array.from({ length: 40 }, (_, index) => ({ id: `${id}-${index}`, idEvent: id, strSport: "Basketball", strEvent: name, strChannel: `Channel ${index}`, strTimeStamp: soon }))
    await writeSnapshot(key, { tvevents: [...rows("201", "Detroit Pistons vs Orlando Magic"), ...rows("202", "Baskonia vs Fenerbahce")] }, Date.now())
    const feed = await getWatchFeed("basketball", now)
    expect(new Set(feed.broadcasts.map((item) => item.matchId))).toEqual(new Set(["tsdb-201", "tsdb-202"]))
  })

  it("gives each sport a turn in the all sports view", () => {
    const rows = [...Array.from({ length: 5 }, (_, index) => ({ sportId: "football" as const, index })), { sportId: "tennis" as const, index: 0 }]
    expect(takeTurns(rows).slice(0, 2).map((row) => row.sportId)).toEqual(["football", "tennis"])
  })
})

describe("a sport with no video", () => {
  it("names the next listed game", async () => {
    await store("baseball", { today: [], listings: [] })
    const feed = await getWatchFeed("baseball", now)
    expect(feed.highlights).toEqual([])
    expect(feed.nextGame).toMatchObject({ matchId: "tsdb-401", title: "Hanshin Tigers vs Yomiuri Giants", competition: "Japanese NPB", startUTC: later })
  })

  it("looks no further when there is video", async () => {
    await store("baseball")
    expect((await getWatchFeed("baseball", now)).nextGame).toBeNull()
  })

  it("says nothing is coming rather than guessing", async () => {
    await store("baseball", { today: [], next: [], listings: [] })
    expect((await getWatchFeed("baseball", now)).nextGame).toBeNull()
  })
})

describe("reading names from the feed", () => {
  it("splits a race weekend from its session", () => {
    expect(splitSession("São Paulo Grand Prix Practice 3")).toEqual({ race: "São Paulo Grand Prix", session: "Practice 3" })
    expect(splitSession("São Paulo Grand Prix Sprint Qualifying")).toEqual({ race: "São Paulo Grand Prix", session: "Sprint Qualifying" })
    expect(splitSession("São Paulo Grand Prix")).toEqual({ race: "São Paulo Grand Prix", session: "Race" })
    expect(splitSession("Qatar GP").race).toBe(splitSession("Qatar Sprint Race").race)
    expect(splitSession("Grand Prix of Qatar Moto2")).toEqual({ race: "Grand Prix of Qatar", session: "Race" })
    expect(splitSession("Penrite Oil Sandown 500 Race 33")).toEqual({ race: "Penrite Oil Sandown 500", session: "Race 33" })
    expect(splitSession("6 Hours of Monza Free Practice 1")).toEqual({ race: "6 Hours of Monza", session: "Free Practice 1" })
  })

  it("keeps a surname's particle when splitting a tennis title", () => {
    expect(splitTennisTitle("Vienna Open de Minaur vs Mannarino")).toEqual({ tournament: "Vienna Open", names: ["de Minaur", "Mannarino"] })
    expect(splitTennisTitle("Swiss Indoors")).toBeNull()
  })

  it.each([
    ["One Day International Series", "ODI"], ["Twenty20 International Series", "T20"], ["International Test Match Series", "Test"], ["ICC World Test Championship", "Test"],
    ["Sheffield Shield", "First-class"], ["Indian Premier League", "T20"], ["The Hundred Women", "The Hundred"], ["ICC Mens T20 World Cup", "T20"], ["Cricket World Cup", "ODI"], ["Some New Trophy", null],
  ])("reads the format of %s", (name, format) => expect(cricketFormat(name)).toBe(format))
})
