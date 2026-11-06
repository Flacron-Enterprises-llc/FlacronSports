// Synthetic stored feeds and an in-memory store for isolated tests only.
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
import { clipsCover, competitionKey, getWatchFeed } from "@/lib/video/catalog"
import { clearClipCache, newestFirst, normalizeClips } from "@/lib/video/scorebat"
import { evaluateViewing } from "@/lib/video/viewing"

const now = new Date()
const day = (date: string, sport: string) => `eventsday.php?${new URLSearchParams({ d: date, s: sport })}`
const raw = (id: string, home: string, away: string, league: string) => ({ idEvent: id, strHomeTeam: home, strAwayTeam: away, strLeague: league, strSport: "Soccer", strStatus: "2H", strTimestamp: new Date(now.getTime() - 3_600_000).toISOString(), intHomeScore: "1", intAwayScore: "0" })
const clip = (title: string, competition: string, dateUTC: string) => ({ id: title, title, competition, thumbnailUrl: null, dateUTC, embedUrl: "https://www.scorebat.com/embed/v/x/" })

const storeDay = (at: number) => writeSnapshot(day(utcDate(now), "Soccer"), { events: [raw("1", "Arsenal", "Chelsea", "English Premier League"), raw("2", "Lyon", "Metz", "French Ligue 1")] }, at)

beforeEach(() => {
  docs.clear()
  clearFeedCache()
  clearClipCache()
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }))
})

describe("clips", () => {
  it("accepts a same-day clip in the feed's date format and puts it first", () => {
    const row = (title: string, date: string) => ({ title, competition: "ENGLAND: Premier League", date, videos: [{ id: title, title: "Highlights", embed: "<iframe src='https://www.scorebat.com/embed/v/a/'></iframe>" }] })
    const clips = normalizeClips([row("Old", "2026-10-20T19:00:00+0000"), row("Today", "2026-11-06T10:30:00+0000")])
    expect(clips[1].dateUTC).toBe("2026-11-06T10:30:00.000Z")
    expect(newestFirst(clips).map((item) => item.title)).toEqual(["Today", "Old"])
  })
  it("sees through the clip feed's wording for a competition", () => {
    expect(competitionKey("ENGLAND: Premier League")).toBe(competitionKey("English Premier League"))
    expect(competitionKey("SPAIN: La Liga")).toBe(competitionKey("Spanish La Liga"))
    expect(competitionKey("CHAMPIONS LEAGUE: League Phase")).toBe(competitionKey("UEFA Champions League"))
    expect(competitionKey("ENGLAND: Premier League")).not.toBe(competitionKey("SCOTLAND: Premiership"))
  })
  it("never stand in for another sport", () => {
    expect(clipsCover("basketball")).toBe(false)
    expect(clipsCover("football")).toBe(true)
    expect(clipsCover()).toBe(true)
  })
})

describe("watch feed", () => {
  it("reports nothing stored as a failure, not an empty page", async () => {
    expect((await getWatchFeed("football", now)).state).toBe("unavailable")
  })

  it("reports an old store as stale, with its real time", async () => {
    const at = now.getTime() - 3 * 3_600_000
    await storeDay(at)
    const feed = await getWatchFeed("football", now)
    expect(feed.state).toBe("stale")
    expect(feed.updatedAt).toBe(new Date(at).toISOString())
  })

  it("is fresh when the job has run, and filters by team and competition", async () => {
    await storeDay(now.getTime() - 60_000)
    await writeSnapshot("scorebat:feed", [clip("Arsenal - Chelsea", "ENGLAND: Premier League", "2026-11-06T10:00:00.000Z"), clip("Lyon - Metz", "FRANCE: Ligue 1", "2026-11-05T10:00:00.000Z")], Date.now())
    const all = await getWatchFeed("football", now)
    expect(all.state).toBe("ok")
    expect(all.competitions).toEqual(["English Premier League", "French Ligue 1"])
    expect(all.clips.map((item) => item.title)).toEqual(["Arsenal - Chelsea", "Lyon - Metz"])

    const league = await getWatchFeed("football", now, { competition: "French Ligue 1" })
    expect(league.clips.map((item) => item.title)).toEqual(["Lyon - Metz"])
    expect(league.competitions).toHaveLength(2)

    const team = await getWatchFeed("football", now, { team: "chels" })
    expect(team.clips.map((item) => item.title)).toEqual(["Arsenal - Chelsea"])
    expect(team.live.map((item) => item.id)).toEqual(["tsdb-1"])
  })

  it("gives another sport no football clips", async () => {
    await writeSnapshot("scorebat:feed", [clip("A - B", "ENGLAND: Premier League", "2026-11-06T10:00:00.000Z")], Date.now())
    expect((await getWatchFeed("basketball", now)).clips).toEqual([])
  })
})

describe("follow live", () => {
  const context = { country: null, platform: "web", entitled: false, now }
  const actions = (status: Parameters<typeof evaluateViewing>[1]["status"]) => evaluateViewing([], { ...context, status }).options.map((item) => item.action)
  it.each(["finished", "canceled", "abandoned", "postponed", "unknown"] as const)("is not offered on a %s event", (status) => expect(actions(status)).toEqual([]))
  it.each(["scheduled", "live", "interrupted"] as const)("is offered on a %s event", (status) => expect(actions(status)).toEqual(["follow_live"]))
})
