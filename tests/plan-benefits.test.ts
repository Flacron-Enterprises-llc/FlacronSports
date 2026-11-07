// Synthetic events for isolated tests only.
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

import { buildAlert, detailAlerts, filteredOut, suppressionReason } from "@/lib/alerts/rules"
import { notificationId, runAlerts } from "@/lib/alerts/notifications"
import { buildFullReport } from "@/lib/content/full-report"
import { followedByAnyone, reportableEvents } from "@/lib/jobs/tick"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/me/preferences-defaults"
import { advancedFigures, basicProfile, headToHead, teamGames } from "@/lib/sports/compare"
import type { MatchDetail } from "@/lib/sports/detail"
import { normalizeEvent } from "@/lib/sports/thesportsdb"

const NOW = new Date("2026-11-06T18:00:00Z")
const game = (id: string, home: string, away: string, homeScore: number | null, awayScore: number | null, status = "FT", league = "UEFA Champions League", at = "2026-11-06T16:00:00") =>
  normalizeEvent({ idEvent: id, strHomeTeam: home, strAwayTeam: away, strLeague: league, strSport: "Soccer", strStatus: status, intHomeScore: homeScore, intAwayScore: awayScore, strTimestamp: at }, "football", NOW)

const prefs = (alerts: Partial<Preferences["alerts"]> = {}, rest: Partial<Preferences> = {}): Preferences => ({
  ...DEFAULT_PREFERENCES, favorites: ["A"], ...rest,
  alerts: { ...DEFAULT_PREFERENCES.alerts, types: ["start", "final", "participants", "scoring", "interval", "highlights"], ...alerts },
})

describe("alerts beyond start and final", () => {
  it("announces a live score, a break, upcoming lineups and highlights to check", () => {
    expect(detailAlerts(game("1", "A", "B", 1, 0, "2H"), NOW)).toEqual(["scoring"])
    expect(detailAlerts(game("1", "A", "B", 0, 0, "1H"), NOW)).toEqual([])
    expect(detailAlerts(game("1", "A", "B", 1, 1, "HT", undefined, "2026-11-06T17:15:00"), NOW)).toEqual(["scoring", "interval"])
    expect(detailAlerts(game("1", "A", "B", null, null, "NS", "L", "2026-11-06T19:00:00"), NOW)).toEqual(["participants"])
    expect(detailAlerts({ ...game("1", "A", "B", 2, 1), videoUrl: "https://youtube.com/watch?v=x" }, NOW)).toEqual(["highlights"])
  })

  it("sends an account with no plan nothing at all", () => {
    expect(suppressionReason(prefs(), "none", "final", NOW)).toBe("plan")
    expect(suppressionReason(prefs(), "basic", "final", NOW)).toBeNull()
  })

  it("keeps these from Basic", () => {
    expect(suppressionReason(prefs(), "basic", "scoring", NOW)).toBe("plan")
    expect(suppressionReason(prefs(), "plus", "scoring", NOW)).toBeNull()
  })

  it("leaves the score out in spoiler mode", () => {
    const live = game("1", "A", "B", 2, 1, "2H")
    expect(buildAlert(live, "scoring", prefs()).body).toContain("2")
    const hidden = buildAlert(live, "scoring", prefs({}, { spoilerMode: true }))
    expect(hidden.body).toBe(hidden.spoilerFreeBody)
    expect(hidden.body).not.toMatch(/\d/)
  })

  it("gives each new score its own alert id, and a repeat none", () => {
    expect(notificationId("u", "e", "scoring", null, "1-0")).not.toBe(notificationId("u", "e", "scoring", null, "2-0"))
    expect(notificationId("u", "e", "final", "2026-11-06T16:00:00Z")).toBe("u_e_final")
  })

  it("sends highlights and lineups only once they are confirmed to exist", async () => {
    const created: string[] = []
    const db = { collection: () => ({ doc: (id: string) => ({ create: async () => void created.push(id), update: async () => undefined }) }) }
    const video = { ...game("1", "A", "B", 2, 1), videoUrl: "https://youtube.com/watch?v=x" }
    const run = (confirm?: (event: unknown, type: string) => Promise<boolean>) =>
      runAlerts({ db: db as never, events: [video], users: [{ uid: "u", prefs: prefs() }], planFor: async () => "plus", emailFor: async () => null, send: async () => true, siteUrl: "https://x", now: NOW, confirm })
    await run(async () => false)
    expect(created.some((id) => id.includes("highlights"))).toBe(false)
    await run(async () => true)
    expect(created.some((id) => id.includes("highlights"))).toBe(true)
  })
})

describe("advanced alert filters", () => {
  const regional = game("1", "A", "B", 1, 0, "FT", "Georgian Liga 3")
  const major = game("2", "A", "B", 1, 0)

  it("apply to Premium only", () => {
    const filtered = prefs({ filters: { sports: [], majorOnly: true } })
    expect(filteredOut(filtered, "premium", regional)).toBe(true)
    expect(filteredOut(filtered, "premium", major)).toBe(false)
    expect(filteredOut(filtered, "plus", regional)).toBe(false)
    expect(suppressionReason(filtered, "premium", "final", NOW, regional)).toBe("filtered")
  })

  it("narrow by sport, and an empty list means every sport", () => {
    expect(filteredOut(prefs({ filters: { sports: ["basketball"], majorOnly: false } }), "premium", major)).toBe(true)
    expect(filteredOut(prefs({ filters: { sports: ["football"], majorOnly: false } }), "premium", major)).toBe(false)
    expect(filteredOut(prefs({ filters: { sports: [], majorOnly: false } }), "premium", major)).toBe(false)
  })
})

describe("comparison", () => {
  const recent = [game("1", "A", "B", 2, 0, "FT", "L", "2026-11-05T10:00:00"), game("2", "C", "A", 1, 1, "FT", "L", "2026-11-03T10:00:00"), game("3", "A", "D", 0, 3, "FT", "L", "2026-11-01T10:00:00"), game("4", "A", "E", null, null, "NS", "L", "2026-11-09T10:00:00")]

  it("counts only finished games, newest first", () => {
    const profile = basicProfile("A", recent, [])
    expect(profile.form).toEqual(["W", "D", "L"])
    expect(profile.record).toMatchObject({ played: 3, wins: 1, draws: 1, losses: 1, scored: 3, conceded: 4 })
    expect(teamGames("Nobody", recent)).toEqual([])
  })

  it("splits home and away and counts clean sheets", () => {
    const figures = advancedFigures("A", recent)
    expect(figures.home.played).toBe(2)
    expect(figures.away.played).toBe(1)
    expect(figures.cleanSheets).toBe(1)
    expect(figures.failedToScore).toBe(1)
  })

  it("finds head to head once, from either side's list", () => {
    expect(headToHead("A", "B", [...recent, ...recent])).toHaveLength(1)
    expect(headToHead("A", "Z", recent)).toEqual([])
  })
})

describe("full reports", () => {
  const detail: MatchDetail = {
    state: "ok", fetchedAt: "",
    timeline: [
      { id: "1", minute: 10, kind: "yellow", side: "home", player: "Y", secondary: null },
      { id: "2", minute: 20, kind: "goal", side: "home", player: "S", secondary: "T" },
      { id: "3", minute: 80, kind: "red", side: "away", player: "R", secondary: null },
    ],
    stats: [{ key: "ball possession", home: "60%", away: "40%" }, { key: "expected_goals", home: "1.4", away: "0.3" }, { key: "total shots", home: "12", away: "4" }, { key: "shots on goal", home: "5", away: "1" }],
    lineups: { home: [], away: [] },
  }
  const event = game("1", "A", "B", 1, 0)

  it("gives Plus the key moments and keeps the analysis for Premium", () => {
    const plus = buildFullReport(event, detail, "plus", "en")
    expect(plus.moments.map((moment) => [moment.minute, moment.team])).toEqual([[20, "A"], [80, "B"]])
    expect(plus.insights).toBeUndefined()
    expect(plus.stats).toBeUndefined()
  })

  it("builds Premium insights only from reported numbers", () => {
    const { insights } = buildFullReport(event, detail, "premium", "en")
    expect(insights).toContain("A had 60% of the ball.")
    expect(insights).toContain("A scored 1 from 1.4 expected goals.")
    expect(insights).toContain("A put 5 of 12 shots on target.")
  })

  it("says so when a game has no detail", () => {
    expect(buildFullReport(event, { ...detail, timeline: [], stats: [] }, "plus", "fr").state).toBe("empty")
  })
})

describe("personalized reports reach followed teams in any league", () => {
  it("keeps major competitions and followed games", () => {
    const kept = reportableEvents([game("1", "A", "B", 1, 0, "FT", "Georgian Liga 3"), game("2", "C", "D", 1, 0), game("3", "E", "F", 1, 0, "FT", "Georgian Liga 3")], { favorites: ["A"], leagues: [], players: [] })
    expect(kept.map((event) => event.id)).toEqual(["tsdb-1", "tsdb-2"])
  })
  it("counts a followed league or a followed player's team, from one list across all members", () => {
    const local = game("3", "E", "F", 1, 0, "FT", "Georgian Liga 3")
    const leagueId = local.competition.id as string
    const followed = followedByAnyone([
      { uid: "a", prefs: prefs({}, { favorites: ["Nobody"], leagues: [{ id: leagueId, name: "Georgian Liga 3", sportId: "football" }] }) },
      { uid: "b", prefs: prefs({}, { favorites: ["Nobody"], leagues: [{ id: leagueId, name: "Georgian Liga 3", sportId: "football" }], players: [{ id: "9", name: "P", team: "K", sportId: "football" }] }) },
    ])
    expect(followed.favorites).toEqual(["Nobody"])
    expect(followed.leagues).toHaveLength(1)
    expect(reportableEvents([local], followed)).toEqual([local])
    expect(reportableEvents([game("4", "K", "L", 1, 0, "FT", "Other Liga")], { ...followed, leagues: [] })).toHaveLength(1)
    expect(reportableEvents([local], { favorites: [], leagues: [], players: [] })).toEqual([])
  })
})
