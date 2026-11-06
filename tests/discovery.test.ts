// Synthetic events and members for isolated tests only.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { feedOwner, feedStatus, hashFeedToken, regenerateFeed, revokeFeed } from "@/lib/calendar/feed"
import { buildCalendar, eventUid } from "@/lib/calendar/ics"
import { relevantToMember } from "@/lib/calendar/agenda"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_PREFERENCES, favoriteTotal, HOME_SECTIONS } from "@/lib/me/preferences-defaults"
import { competitionsToday, containsText, eventMatches } from "@/lib/search/match"
import { createShare, readShare, shareCard } from "@/lib/share/cards"
import { isAfricanCompetition, isAfricanEvent, isAfricanNationalTeam } from "@/lib/sports/africa"
import { canRemind, followPriority, isFollowed, moveItem, toggleReminder } from "@/lib/sports/following"
import { resolveHomeFeed, trendingCompetitions } from "@/lib/sports/home-feed"
import { normalizePlayer } from "@/lib/sports/player"
import { sportSwitchPath } from "@/lib/sports/sport-link"
import { formByGame, tableAround } from "@/lib/sports/detail"
import type { SportEvent } from "@/lib/sports/types"
import { fakeDb } from "./fake-db"

const game = (overrides: Partial<SportEvent> = {}): SportEvent => ({
  id: "m1", sportId: "football", eventType: "match", participantType: "team",
  participants: [{ id: "1", name: "Harbor City", role: "home", badgeUrl: null }, { id: "2", name: "Lake Town", role: "away", badgeUrl: null }],
  competition: { id: "77", name: "Coastal League", country: "Nowhere" },
  scheduledStartUTC: "2026-11-10T18:00:00.000Z", status: "scheduled", providerStatus: "NS", score: { kind: "none" }, venue: null,
  provider: { name: "p", eventId: "1" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false }, ...overrides,
})

const finished = (home: number, away: number, overrides: Partial<SportEvent> = {}) => game({ status: "finished", score: { kind: "team", home, away }, ...overrides })
const now = new Date("2026-11-06T12:00:00Z")
const following = (overrides: Partial<typeof DEFAULT_PREFERENCES> = {}) => ({ ...DEFAULT_PREFERENCES, ...overrides })

describe("following", () => {
  it("counts teams, leagues and players toward the favorites limit", () => {
    expect(favoriteTotal(following({ favorites: ["A"], leagues: [{ id: "1", name: "L", sportId: "football" }], players: [{ id: "2", name: "P", team: null, sportId: "football" }] }))).toBe(3)
  })
  it("follows a game through its league or a followed player's team", () => {
    expect(isFollowed(following({ leagues: [{ id: "77", name: "Coastal League", sportId: "football" }] }), game())).toBe(true)
    expect(isFollowed(following({ players: [{ id: "9", name: "P", team: "Lake Town", sportId: "football" }] }), game())).toBe(true)
    expect(isFollowed(following(), game())).toBe(false)
  })
  it("orders by the member's own team order, with leagues after teams", () => {
    const prefs = following({ favorites: ["Lake Town", "Harbor City"], leagues: [{ id: "88", name: "Other", sportId: "football" }] })
    const other = game({ participants: [], competition: { id: "88", name: "Other", country: null } })
    expect(followPriority(prefs, game())).toBe(0)
    expect(followPriority(prefs, other)).toBeGreaterThan(followPriority(prefs, game()))
    expect(followPriority(following(), game())).toBe(Number.MAX_SAFE_INTEGER)
  })
  it("moves items and stops at the ends", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"])
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"])
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"])
  })
  it("adds a reminder, removes it, and drops ones long past", () => {
    const added = toggleReminder([], game(), now)
    expect(added).toEqual([{ eventId: "m1", title: "Harbor City / Lake Town", startUTC: game().scheduledStartUTC }])
    expect(toggleReminder(added, game(), now)).toEqual([])
    const old = { eventId: "old", title: "Old", startUTC: "2026-11-01T00:00:00.000Z" }
    expect(toggleReminder([old], game(), now).map((item) => item.eventId)).toEqual(["m1"])
  })
  it("offers the bell only before a game with a real start", () => {
    expect(canRemind(game(), now)).toBe(true)
    expect(canRemind(game({ dateOnly: true }), now)).toBe(false)
    expect(canRemind(game({ status: "live" }), now)).toBe(false)
    expect(canRemind(game({ scheduledStartUTC: "2026-11-01T00:00:00.000Z" }), now)).toBe(false)
  })
  it("treats a game with a bell as the member's own", () => {
    expect(relevantToMember(following({ reminders: [{ eventId: "m1", title: "t", startUTC: null }] }), game())).toBe(true)
  })
})

describe("calendar feed", () => {
  const options = { name: "Matches", siteUrl: "https://site.test", now, matchPath: (id: string) => `/app/match/${id}` }

  it("keeps one UID for a game whose start moves", () => {
    const first = buildCalendar([game()], options)
    const moved = buildCalendar([game({ scheduledStartUTC: "2026-11-11T20:00:00.000Z" })], options)
    const uid = `UID:${eventUid(game())}`
    expect(first).toContain(uid)
    expect(moved).toContain(uid)
    expect(moved).toContain("DTSTART:20261111T200000Z")
  })
  it("never carries a score, a result or a source name", () => {
    const text = buildCalendar([
      finished(3, 1),
      game({ id: "m2", status: "finished", eventName: "Grand Prix", participants: [], score: { kind: "classification", entries: [{ position: 1, name: "Winner Driver", team: null, time: null }] } }),
    ], options)
    expect(text).not.toMatch(/3 - 1|Winner Driver|tsdb/i)
    expect(text).toContain("SUMMARY:Grand Prix")
  })
  it("writes a date-only game as a date and a canceled game as cancelled", () => {
    expect(buildCalendar([game({ dateOnly: true })], options)).toContain("DTSTART;VALUE=DATE:20261110")
    expect(buildCalendar([game({ status: "canceled" })], options)).toContain("STATUS:CANCELLED")
  })
  it("escapes text, folds long lines and ends every line with CRLF", () => {
    const text = buildCalendar([game({ venue: "Stade, Nord; Sud", competition: { id: "1", name: "É".repeat(80), country: null } })], options)
    expect(text).toContain("LOCATION:Stade\\, Nord\\; Sud")
    for (const line of text.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/)
  })
  it("stores only a hash, and regenerating kills the old link", async () => {
    const { db } = fakeDb()
    const first = await regenerateFeed(db, "u1")
    expect(await db.get(`calendar_feeds/${first.token}`)).toBeNull()
    expect(await feedOwner(db, first.token)).toBe("u1")
    const second = await regenerateFeed(db, "u1")
    expect(await feedOwner(db, first.token)).toBeNull()
    expect(await feedOwner(db, second.token)).toBe("u1")
    await revokeFeed(db, "u1")
    expect(await feedOwner(db, second.token)).toBeNull()
    expect((await feedStatus(db, "u1")).active).toBe(false)
  })
  it("refuses a malformed token without a lookup", async () => {
    expect(await feedOwner(fakeDb().db, "../secret")).toBeNull()
    expect(hashFeedToken("a")).toHaveLength(64)
  })
})

describe("share cards", () => {
  const event = finished(3, 1)
  it("hides the score unless the sharer chose it, on every field", () => {
    const hidden = shareCard(event, { locale: "en", reveal: false })
    expect(hidden.score).toBeNull()
    expect(JSON.stringify(hidden)).not.toMatch(/3 - 1/)
    expect(hidden.kind).toBe("result")
    expect(shareCard(event, { locale: "en", reveal: true }).score).toBe("3 - 1")
  })
  it("never lists a classification's entrants without the choice", () => {
    const race = game({ status: "finished", eventName: "Grand Prix", participants: [{ id: null, name: "Winner Driver", role: "competitor", badgeUrl: null }], score: { kind: "classification", entries: [{ position: 1, name: "Winner Driver", team: null, time: null }] } })
    expect(JSON.stringify(shareCard(race, { locale: "en", reveal: false }))).not.toContain("Winner Driver")
  })
  it("is localized and links to the match", () => {
    const card = shareCard(game(), { locale: "fr", reveal: false })
    expect(card.heading).toBe(getDictionary("fr").share.fixture)
    expect(card.matchPath).toBe("/app/match/m1")
  })
  it("keeps the sharer's choice in a stored record with no account on it", async () => {
    const { db } = fakeDb()
    const id = await createShare(db, "m1", "en", false, now)
    expect(await readShare(db, id)).toEqual({ matchId: "m1", locale: "en", reveal: false, createdAtUTC: now.toISOString() })
    expect(await readShare(db, "bad/id")).toBeNull()
  })
})

describe("African discovery", () => {
  it("recognizes competitions and national teams, and leaves others out", () => {
    expect(isAfricanCompetition("CAF Champions League")).toBe(true)
    expect(isAfricanCompetition("Africa Cup of Nations Women")).toBe(true)
    expect(isAfricanCompetition("Senegal Ligue 1")).toBe(true)
    expect(isAfricanCompetition("Nigerian Premier League")).toBe(true)
    expect(isAfricanCompetition("Some League", "Morocco")).toBe(true)
    expect(isAfricanCompetition("UEFA Champions League", "Morocco")).toBe(false)
    expect(isAfricanCompetition("English Premier League", "England")).toBe(false)
    expect(isAfricanCompetition("Papua New Guinea League")).toBe(false)
    expect(isAfricanNationalTeam("Senegal")).toBe(true)
    expect(isAfricanNationalTeam("Senegal U17")).toBe(true)
    expect(isAfricanNationalTeam("Senegal Women")).toBe(true)
    expect(isAfricanNationalTeam("Niger Tornadoes")).toBe(false)
    expect(isAfricanNationalTeam("Papua New Guinea")).toBe(false)
  })
  it("marks a world competition game through its national team", () => {
    const participants = [{ id: "1", name: "Ghana", role: "home" as const, badgeUrl: null }, { id: "2", name: "Japan", role: "away" as const, badgeUrl: null }]
    expect(isAfricanEvent(game({ participants, competition: { id: "1", name: "FIFA World Cup", country: "USA" } }))).toBe(true)
    expect(isAfricanEvent(game())).toBe(false)
  })
  it("does not imply viewing in its wording", () => {
    for (const locale of ["en", "fr"] as const) expect(getDictionary(locale).discover.africaLead).not.toMatch(/watch now|en direct/i)
  })
})

describe("search matching", () => {
  it("ignores case and accents", () => {
    expect(containsText("Málaga", "malaga")).toBe(true)
    expect(eventMatches(game(), "lake")).toBe(true)
    expect(eventMatches(game(), "coastal")).toBe(true)
    expect(eventMatches(game(), "nothing")).toBe(false)
  })
  it("groups today's competitions and skips one with no id", () => {
    const hits = competitionsToday([game(), game({ id: "m2" }), game({ id: "m3", competition: { id: null, name: "Coastal Cup", country: null } })], (name) => containsText(name, "coastal"))
    expect(hits).toEqual([{ id: "77", name: "Coastal League", sportId: "football", today: 2 }])
  })
})

describe("home feed", () => {
  it("defaults to every section shown", () => {
    expect(resolveHomeFeed(undefined)).toEqual({ order: [...HOME_SECTIONS], hidden: [] })
  })
  it("keeps a saved order and adds new sections at the end", () => {
    const { order, hidden } = resolveHomeFeed({ order: ["news", "live"], hidden: ["trending"] })
    expect(order.slice(0, 2)).toEqual(["news", "live"])
    expect(order).toHaveLength(HOME_SECTIONS.length)
    expect(hidden).toEqual(["trending"])
  })
  it("ranks trending competitions by real live games", () => {
    const events = [game(), game({ id: "m2", status: "live", competition: { id: "5", name: "Quiet Cup", country: null } })]
    expect(trendingCompetitions(events).map((item) => [item.name, item.live, item.games])).toEqual([["Quiet Cup", 1, 1], ["Coastal League", 0, 1]])
  })
})

describe("team page", () => {
  it("works out form from finished games only, newest first", () => {
    const form = formByGame([
      finished(2, 0, { id: "a", scheduledStartUTC: "2026-11-01T00:00:00.000Z" }),
      finished(1, 1, { id: "b", scheduledStartUTC: "2026-11-02T00:00:00.000Z" }),
      finished(0, 3, { id: "c", scheduledStartUTC: "2026-11-03T00:00:00.000Z" }),
      game({ id: "d", status: "finished" }),
    ], "lake town")
    expect(form).toEqual([{ eventId: "c", result: "win" }, { eventId: "b", result: "draw" }, { eventId: "a", result: "loss" }])
  })
  it("shows the rows around a team, and none for a team not listed", () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g"].map((team) => ({ team }))
    expect(tableAround(rows, "A").map((row) => row.team)).toEqual(["a", "b", "c", "d", "e"])
    expect(tableAround(rows, "d").map((row) => row.team)).toEqual(["b", "c", "d", "e", "f"])
    expect(tableAround(rows, "g").map((row) => row.team)).toEqual(["c", "d", "e", "f", "g"])
    expect(tableAround(rows, "z")).toEqual([])
  })
})

describe("athlete profiles", () => {
  const sportOf = (key: string | null | undefined) => (key === "Soccer" ? ("football" as const) : undefined)
  it("keeps only what the source states", () => {
    const player = normalizePlayer({ idPlayer: "9", strPlayer: "A Player", strSport: "Soccer", strTeam: "_Free Agent Soccer", strHeight: "", dateBorn: "0000-00-00" }, sportOf)
    expect(player).toMatchObject({ id: "9", name: "A Player", team: null, height: null, born: null, weight: null })
  })
  it("leaves out a sport this site does not cover", () => {
    expect(normalizePlayer({ idPlayer: "9", strPlayer: "A", strSport: "Darts" }, sportOf)).toBeNull()
  })
})

describe("sport switcher", () => {
  it("stays on a page with a sport filter and keeps its other filters", () => {
    expect(sportSwitchPath("/app/scores", "status=live&page=3", "tennis")).toBe("/app/scores?status=live&sport=tennis")
    expect(sportSwitchPath("/app/watch", "sport=tennis", null)).toBe("/app/watch")
    expect(sportSwitchPath("/app/search", "q=abc", "cricket")).toBe("/app/search?q=abc&sport=cricket")
  })
  it("opens Scores from any other page", () => {
    expect(sportSwitchPath("/app/settings", "tab=1", "rugby")).toBe("/app/scores?sport=rugby")
  })
})

describe("wiring", () => {
  it("guards every new member route with the plan check", () => {
    for (const path of ["app/api/search/route.ts", "app/api/players/[id]/route.ts", "app/api/me/calendar/route.ts", "app/api/me/calendar-feed/route.ts", "app/api/me/board/route.ts", "app/api/me/saved-reports/route.ts", "app/api/share/route.ts"]) {
      expect(readFileSync(path, "utf8"), path).toMatch(/requireSubscriber\(user\.uid\)|requireDataAccess\(user\)/)
    }
  })
  it("includes saved reports and calendar records in export and deletion", () => {
    const records = readFileSync("lib/me/records.ts", "utf8")
    for (const name of ["saved_reports", "user_calendar_feeds", "calendar_feeds"]) expect(records).toContain(name)
    expect(readFileSync("app/api/me/route.ts", "utf8")).toContain("...savedReports")
    expect(readFileSync("app/api/me/export/route.ts", "utf8")).toContain("savedReports:")
  })
})
