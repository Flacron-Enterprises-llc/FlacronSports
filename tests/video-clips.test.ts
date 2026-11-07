// Rows copied from the live video feed on 2026-11-07, with the player ids and embed tokens replaced.
// Team and competition names on both sides are the real ones. Isolated tests only.
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
import type { SportEvent } from "@/lib/sports/types"
import { clipPlayer, getWatchFeed, viewingFor } from "@/lib/video/catalog"
import { findGame, plainName, sameTeam } from "@/lib/video/clip-match"
import { competitionKey, splitSession } from "@/lib/video/facets"
import { clearClipCache, linkClips, normalizeClips, refreshClips, streamOpen, type RawClip, type StoredClip } from "@/lib/video/scorebat"

const EMBED_TOKEN = "EMBEDTOKEN123"
const player = (id: string) => `https://www.scorebat.com/embed/v/${id}/?token=${EMBED_TOKEN}&utm_source=api&utm_medium=video&utm_campaign=featured-feed`
const video = (id: string, title: string) => ({
  id,
  title,
  url: player(id),
  embed: `<div style='width:100%;height:0px;position:relative;padding-bottom:56.250%;background:#000;'><iframe src='${player(id)}' frameborder='0' width='100%' height='100%' allowfullscreen allow='autoplay; fullscreen' style='width:100%;height:100%;'></iframe></div>`,
})
const row = (title: string, competition: string, date: string, matchview: string, videos: ReturnType<typeof video>[]): RawClip => {
  const [home, away] = title.split(" - ")
  return {
    title, competition, date, videos,
    matchviewUrl: `https://www.scorebat.com/embed/matchview/${matchview}/?token=${EMBED_TOKEN}`,
    thumbnail: `https://www.scorebat.com/og/m/og${matchview}.jpeg`,
    homeTeam: { name: home }, awayTeam: { name: away },
  }
}

const famalicao = row("Famalicao - Arouca", "PORTUGAL: Liga Portugal", "2026-11-06T20:45:00+00:00", "1962000", [video("goal1=", "1-0 Paulo Moreira"), video("high1=", "Highlights")])
const sevilla = row("Sevilla - Alaves", "SPAIN: La Liga", "2026-11-06T20:00:00+00:00", "1962001", [video("high2=", "Highlights"), video("high3=", "Highlights")])
const saoPaulo = row("Sao Paulo - Corinthians", "BRAZIL: Serie A", "2026-11-05T00:30:00+00:00", "1841766", [video("high4=", "Highlights"), video("live1=", "Live Stream"), video("live2=", "Live Stream")])
const tokyo = row("F.C.Tokyo - Kashima Antlers", "JAPAN: J-League", "2026-11-07T06:00:00+00:00", "1897743", [video("live3=", "Live Stream")])

const game = (id: string, home: string, away: string, competition: string, start: string, status: SportEvent["status"] = "finished") => ({
  id, sportId: "football", status, scheduledStartUTC: start, competition: { name: competition }, participants: [{ name: home }, { name: away }],
}) as unknown as SportEvent

const at = (iso: string) => new Date(iso).getTime()

describe("clip rows", () => {
  it("keeps every video of a game, each by what it is", () => {
    const [clip] = normalizeClips([famalicao])
    expect(clip.videos?.map((item) => [item.kind, item.label])).toEqual([["goal", "1-0 Paulo Moreira"], ["highlight", "Highlights"], ["match", ""]])
    expect(clip.embedUrl).toBe(player("high1="))
    expect(clip.home).toBe("Famalicao")
  })

  it("keeps both highlights where a game has two", () => {
    expect(normalizeClips([sevilla])[0].videos?.filter((item) => item.kind === "highlight")).toHaveLength(2)
  })

  it("never treats a game with only a stream as highlights", () => {
    const [clip] = normalizeClips([tokyo])
    expect(clip.videos?.filter((item) => item.kind !== "match").map((item) => item.kind)).toEqual(["live"])
  })

  it("refuses a match page on another host", () => {
    const [clip] = normalizeClips([{ ...sevilla, matchviewUrl: "https://evil.example/embed/matchview/1/" }])
    expect(clip.videos?.some((item) => item.kind === "match")).toBe(false)
  })
})

describe("names across the two feeds", () => {
  it.each([
    ["Atletico Madrid", "Atlético Madrid"], ["F.C.Tokyo", "FC Tokyo"], ["PSG", "Paris Saint-Germain"], ["AZ", "AZ Alkmaar"], ["Slavia Praha", "Slavia Prague"],
    ["Wolves", "Wolverhampton Wanderers"], ["Wisla Krakow", "Wisła Kraków"], ["Atletico-MG", "Atlético Mineiro"], ["Atletico-PR", "Athletico Paranaense"], ["Kyoto Purple Sanga", "Kyoto Sanga"],
    ["St. Gilloise", "Union Saint-Gilloise"], ["Crvena Zvezda", "Crvena Zvezda"], ["Alaves", "Deportivo Alavés"], ["B.B. Gaziantep", "Gaziantep"], ["SK Brann", "Brann"], ["Coventry", "Coventry City"],
  ])("%s is %s", (a, b) => expect(sameTeam(a, b)).toBe(true))

  it.each([
    ["Arsenal", "Arsenal Women"], ["AC Milan", "AC Milan Women"], ["Barcelona", "Barcelona B"], ["Chelsea", "Chelsea U21"], ["Bristol City", "Bristol Rovers"],
    ["Manchester United", "Manchester City"], ["Inter Milan", "AC Milan"], ["AEK Larnaca", "AEK Athens"], ["Oxford City", "Oxford United"],
  ])("%s is not %s", (a, b) => expect(sameTeam(a, b)).toBe(false))

  it("folds letters that do not decompose", () => expect(plainName("Łódź Ørsted Kasımpaşa")).toBe("lodz orsted kasimpasa"))

  it("reads the clip feed's wording for a European cup", () => {
    expect(competitionKey("EUROPE: Champions League, League Stage")).toBe(competitionKey("UEFA Champions League"))
    expect(competitionKey("EUROPE: Conference League, League Stage")).toBe(competitionKey("UEFA Conference League"))
    expect(competitionKey("TURKIYE: Super Lig")).toBe(competitionKey("Turkish Super Lig"))
  })
})

describe("tying a clip to a game", () => {
  const clip = { home: "Arsenal", away: "Chelsea", competition: "ENGLAND: Premier League", dateUTC: "2026-11-01T16:30:00.000Z" }

  it("finds the game on the same date", () => {
    const events = [game("tsdb-1", "Arsenal", "Chelsea", "English Premier League", "2026-11-01T16:30:00.000Z"), game("tsdb-2", "Arsenal Women", "Chelsea Women", "FA WSL", "2026-11-01T12:00:00.000Z")]
    expect(findGame(clip, events)?.id).toBe("tsdb-1")
  })

  it("ignores a return fixture weeks away, and leaves a clip with no game unlinked", () => {
    expect(findGame(clip, [game("tsdb-1", "Arsenal", "Chelsea", "English Premier League", "2026-11-22T16:30:00.000Z")])).toBeNull()
  })

  it("does not take a women's game for the men's", () => {
    expect(findGame(clip, [game("tsdb-2", "Arsenal Women", "Chelsea Women", "FA WSL", "2026-11-01T16:30:00.000Z")])).toBeNull()
  })

  it("accepts one sure name at the same kick-off in the same competition", () => {
    const named = { home: "Karmiotissa", away: "Inter Club d'Escaldes", competition: "EUROPE: Conference League, League Stage", dateUTC: "2026-11-05T17:45:00.000Z" }
    const sameCup = game("tsdb-3", "Red Devils", "Inter Club d'Escaldes", "UEFA Conference League", "2026-11-05T18:00:00.000Z")
    expect(findGame(named, [sameCup])?.id).toBe("tsdb-3")
    expect(findGame(named, [{ ...sameCup, competition: { name: "Andorran League" } } as SportEvent])).toBeNull()
    expect(findGame(named, [{ ...sameCup, scheduledStartUTC: "2026-11-06T02:00:00.000Z" }])).toBeNull()
  })

  it("leaves a clip unlinked when two games fit equally", () => {
    const events = [game("tsdb-1", "Arsenal", "Chelsea", "A", "2026-11-01T18:30:00.000Z"), game("tsdb-2", "Arsenal", "Chelsea", "B", "2026-11-01T14:30:00.000Z")]
    expect(findGame(clip, events)).toBeNull()
  })

  it("keeps a link when the store cannot answer this time", () => {
    const fresh = normalizeClips([sevilla])
    const known = linkClips(fresh, [game("tsdb-9", "Sevilla", "Deportivo Alavés", "Spanish La Liga", "2026-11-06T20:00:00.000Z")])
    expect(known[0].game).toEqual({ competition: "Spanish La Liga", teams: ["Sevilla", "Deportivo Alavés"] })
    expect(linkClips(fresh, [], known)[0].matchId).toBe("tsdb-9")
    expect(linkClips(fresh, [])[0].matchId).toBeNull()
  })
})

describe("when a stream may be offered", () => {
  const start = "2026-11-07T06:00:00.000Z"
  it("only while the game can be on", () => {
    expect(streamOpen(start, "live", at("2026-11-07T08:23:00Z"))).toBe(true)
    expect(streamOpen(start, undefined, at("2026-11-07T05:45:00Z"))).toBe(true)
    expect(streamOpen(start, "scheduled", at("2026-11-07T04:00:00Z"))).toBe(false)
    expect(streamOpen(start, "finished", at("2026-11-07T07:00:00Z"))).toBe(false)
    expect(streamOpen(start, "live", at("2026-11-07T11:00:00Z"))).toBe(false)
    expect(streamOpen(null, "live", at("2026-11-07T07:00:00Z"))).toBe(false)
  })
})

describe("motorsport sessions", () => {
  it.each([
    ["Pirelli Spanish Round Superpole Race", "Pirelli Spanish Round", "Superpole Race"],
    ["Boost Mobile Gold Coast 500 Qualifying Race 31", "Boost Mobile Gold Coast 500", "Qualifying Race 31"],
    ["Penrite Oil Sandown 500 Top 10 Shootout Race 34", "Penrite Oil Sandown 500", "Top 10 Shootout Race 34"],
    ["Austin Feature Race", "Austin", "Feature Race"],
    ["Mexico City Grand Prix", "Mexico City Grand Prix", "Race"],
    ["Qatar GP", "Qatar", "Race"],
  ])("%s", (name, race, session) => expect(splitSession(name)).toEqual({ race, session }))
})

describe("through the feed", () => {
  const now = new Date()
  const iso = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()
  const rawEvent = (id: string, home: string, away: string, league: string, start: string, status: string, sport = "Soccer") => ({ idEvent: id, strHomeTeam: home, strAwayTeam: away, strLeague: league, strSport: sport, strStatus: status, strTimestamp: start, intHomeScore: "1", intAwayScore: "0" })
  const dayKey = (hours: number, sport = "Soccer") => `eventsday.php?${new URLSearchParams({ d: utcDate(new Date(now.getTime() + hours * 3_600_000)), s: sport })}`

  // The same real rows, moved so one game is on now and one ended two days ago.
  const stored: RawClip[] = [
    { ...tokyo, date: iso(-2) },
    { ...saoPaulo, date: iso(-50) },
    { ...famalicao, date: iso(-12) },
  ]
  const feedResponse = () => new Response(JSON.stringify({ response: stored }), { status: 200 })

  beforeEach(async () => {
    docs.clear()
    clearFeedCache()
    clearClipCache()
    vi.stubEnv("SCOREBAT_TOKEN", "api-token")
    vi.stubGlobal("fetch", async (url: string) => (String(url).startsWith("https://www.scorebat.com") ? feedResponse() : new Response("{}", { status: 500 })))
    const at = Date.now()
    const rows = [
      rawEvent("101", "FC Tokyo", "Kashima Antlers", "Japanese J1 League", iso(-2), "2H"),
      rawEvent("102", "São Paulo", "Corinthians", "Brazilian Serie A", iso(-50), "FT"),
      rawEvent("103", "Famalicao", "Arouca", "Portuguese Primeira Liga", iso(-12), "FT"),
    ]
    const byDay = new Map<string, unknown[]>()
    for (const [hours, index] of [[-2, 0], [-50, 1], [-12, 2]] as const) byDay.set(dayKey(hours), [...(byDay.get(dayKey(hours)) ?? []), rows[index]])
    for (const [key, events] of byDay) await writeSnapshot(key, { events }, at)
    await writeSnapshot(dayKey(0), { events: byDay.get(dayKey(0)) ?? [] }, at)
    expect(await refreshClips()).toBe("stored_3")
  })

  it("leads with the games, links them and groups goals under them", async () => {
    const feed = await getWatchFeed("football", now)
    const clip = feed.clips.find((item) => item.title === "Famalicao - Arouca")
    expect(clip?.matchId).toBe("tsdb-103")
    expect(clip?.competition).toBe("Portuguese Primeira Liga")
    expect(clip?.videos?.map((item) => item.kind)).toEqual(["goal", "highlight"])
    expect(feed.clips.some((item) => item.title.startsWith("F.C.Tokyo"))).toBe(false)
    expect(feed.facets?.find((item) => item.key === "team")?.options).toContain("São Paulo")
    expect(feed.facets?.find((item) => item.key === "team")?.options).not.toContain("Sao Paulo")
  })

  it("lists a stream for a game on now and never for one that has ended", async () => {
    const feed = await getWatchFeed("football", now)
    expect(feed.streams?.map((item) => [item.title, item.matchId])).toEqual([["F.C.Tokyo - Kashima Antlers", "tsdb-101"]])
    expect((await getWatchFeed("basketball", now)).streams).toEqual([])
  })

  it("sends no player address or embed token to a page", async () => {
    const feed = JSON.stringify(await getWatchFeed("football", now))
    const viewing = JSON.stringify(await viewingFor("tsdb-103", "PK"))
    for (const body of [feed, viewing]) {
      expect(body).not.toContain(EMBED_TOKEN)
      expect(body).not.toContain("api-token")
      expect(body).not.toContain("/embed/")
    }
  })

  it("gives a football game its clips where it had no video source", async () => {
    const viewing = await viewingFor("tsdb-103", "PK")
    expect(viewing.options.filter((item) => item.action === "watch_highlights")).toHaveLength(2)
    expect(viewing.reasons).toEqual([])
    expect(viewing.clips?.map((item) => item.kind)).toEqual(["goal", "highlight", "match"])
    expect(viewing.video).toBeNull()
  })

  it("offers a live stream as watching live, and leaves out one whose game ended", async () => {
    const live = await viewingFor("tsdb-101", "PK")
    expect(live.options.map((item) => item.action)).toContain("watch_live")
    expect(live.clips?.map((item) => item.kind)).toEqual(["live", "match"])
    const ended = await viewingFor("tsdb-102", "PK")
    expect(ended.clips?.map((item) => item.kind)).toEqual(["highlight", "match"])
    expect(ended.options.map((item) => item.action)).not.toContain("watch_live")
  })

  it("issues a player address only for a held id, and refuses a closed stream", async () => {
    const clips = (await getWatchFeed("football", now)).clips
    const goal = clips.find((item) => item.title.startsWith("Famalicao"))?.videos?.[0]
    expect(await clipPlayer(goal?.id as string)).toContain(`/embed/v/goal1=/?token=${EMBED_TOKEN}`)
    expect(await clipPlayer("0000000000000000")).toBeNull()
    const ended = normalizeClips([{ ...saoPaulo, date: iso(-50) }])[0].videos?.find((item) => item.kind === "live")
    expect(await clipPlayer(ended?.id as string)).toBeNull()
  })

  it("still reads a stored copy from before clips held all their videos", async () => {
    clearClipCache()
    const old: StoredClip = { id: "aaaaaaaaaaaaaaaa", title: "Lyon - Metz", competition: "FRANCE: Ligue 1", thumbnailUrl: null, dateUTC: iso(-5), embedUrl: player("old=") }
    await writeSnapshot("scorebat:feed", [old], Date.now())
    expect((await getWatchFeed("football", now)).clips.map((item) => item.id)).toEqual([old.id])
    expect(await clipPlayer(old.id)).toBe(player("old="))
  })

  it("keeps a one-day international on the TV list through the day", async () => {
    await writeSnapshot(dayKey(0, "Cricket"), { events: [{ ...rawEvent("201", "New Zealand Cricket", "India Cricket", "One Day International Series", iso(-6), "", "Cricket") }] }, Date.now())
    await writeSnapshot(`eventstv.php?${new URLSearchParams({ d: utcDate(now), s: "Cricket" })}`, { tvevents: [{ id: "1", idEvent: "201", strSport: "Cricket", strEvent: "New Zealand Cricket vs India Cricket", strChannel: "Sky Sport 1 NZ", strCountry: "New Zealand", strTimeStamp: iso(-6) }] }, Date.now())
    const feed = await getWatchFeed("cricket", now)
    expect(feed.broadcasts.map((item) => item.channel)).toEqual(["Sky Sport 1 NZ"])
    expect(feed.facets?.map((item) => item.key)).toContain("team")
  })
})
