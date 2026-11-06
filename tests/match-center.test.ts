// Result text below follows the shapes the provider really returned; events are synthetic.
import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { formByGame, isStaleUpdate, labelStats, labelTimeline, normalizeStats, normalizeTimeline, teamForm } from "@/lib/sports/detail"
import { parseBreakdown, parseClassification } from "@/lib/sports/results"
import { competitionOptions, filterScores, followFilter, parseFollowFilter } from "@/lib/sports/score-filters"
import { currentPeriod, normalizeEvent, normalizeStatus } from "@/lib/sports/thesportsdb"
import type { SportEvent } from "@/lib/sports/types"

const raw = { idEvent: "1", strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strTimestamp: "2026-11-05T18:00:00" }
const sides = (home: string, away: string, homeScore: number, awayScore: number) => ({ home, away, homeScore, awayScore })

describe("how a game ended", () => {
  it.each([
    ["AET", "football", "extra-time"], ["PEN", "football", "penalties"], ["AOT", "basketball", "overtime"],
    ["AP", "ice-hockey", "shootout"], ["AWD", "football", "awarded"],
  ] as const)("keeps %s apart from a plain finish", (status, sport, conclusion) => {
    const event = normalizeEvent({ ...raw, strStatus: status, intHomeScore: "1", intAwayScore: "1" }, sport)
    expect(event).toMatchObject({ status: "finished", conclusion })
  })
  it("leaves a regular finish alone", () => expect(normalizeEvent({ ...raw, strStatus: "FT" }, "football").conclusion).toBeUndefined())
  it("reads the second postponed spelling", () => expect(normalizeStatus({ idEvent: "1", strStatus: "POST" })).toBe("postponed"))
  it("shows a shootout score only when the source gives one", () => {
    expect(normalizeEvent({ ...raw, strStatus: "PEN", intHomeScore: "0", intAwayScore: "0" }, "football").shootout).toBeUndefined()
    expect(normalizeEvent({ ...raw, strStatus: "PEN", intHomeScore: "0", intAwayScore: "0", intHomeScoreExtra: "4", intAwayScoreExtra: "3" }, "football").shootout).toEqual({ home: 4, away: 3 })
    expect(normalizeEvent({ ...raw, strStatus: "AET", intHomeScoreExtra: "4", intAwayScoreExtra: "3" }, "football").shootout).toBeUndefined()
  })
  it.each([["1H", { key: "first-half" }], ["Q3", { key: "quarter", number: 3 }], ["P2", { key: "period", number: 2 }], ["IN7", { key: "inning", number: 7 }], ["OT", { key: "overtime" }], ["???", null]])("names the period for %s", (code, expected) => {
    expect(currentPeriod(code)).toEqual(expected)
  })
  it("has a label for every conclusion and period in both languages", () => {
    for (const locale of ["en", "fr"] as const) {
      const t = getDictionary(locale)
      expect(Object.keys(t.status.conclusions)).toHaveLength(6)
      expect(Object.keys(t.match.periods)).toHaveLength(10)
    }
  })
})

describe("period scores", () => {
  it("reads basketball quarters and overtime", () => {
    const text = " New Orleans Pelicans Quarters:<br>24 18 28 34 16<br><br>Utah Jazz Quarters:<br>24 13 43 24 9"
    const parsed = parseBreakdown(text, "basketball", sides("New Orleans Pelicans", "Utah Jazz", 120, 113))
    expect(parsed?.segments.at(-1)).toEqual({ kind: "overtime", number: 1, home: 16, away: 9 })
    expect(parsed?.segments).toHaveLength(5)
  })
  it("refuses a college row that hides halves in empty quarters", () => {
    expect(parseBreakdown(" Butler Quarters:<br>0 52 0 47 <br><br>Fairleigh Dickinson Quarters:<br>0 29 0 36 ", "basketball", sides("Butler", "Fairleigh Dickinson", 99, 65))).toBeNull()
  })
  it("refuses a row that does not add up to the score", () => {
    expect(parseBreakdown("A Quarters:<br>1 1 1 1<br><br>B Quarters:<br>1 1 1 1", "basketball", sides("A", "B", 90, 4))).toBeNull()
  })
  it("reads baseball innings, leaving an unplayed half inning empty", () => {
    const text = " Milwaukee Brewers Innings:<br>2 0 0 1 0 1 1 0  <br>Hits: 11 - Errors: 1<br><br>Tampa Bay Rays Innings:<br>4 0 0 0 0 0 0 0 0 <br>Hits: 7 - Errors: 1"
    const parsed = parseBreakdown(text, "baseball", sides("Milwaukee Brewers", "Tampa Bay Rays", 5, 4))
    expect(parsed?.segments.at(-1)).toEqual({ kind: "inning", number: 9, home: null, away: 0 })
    expect(parsed?.hits).toEqual({ home: 11, away: 7 })
    expect(parsed?.errors).toEqual({ home: 1, away: 1 })
  })
  it("reads American football quarters and overtime", () => {
    const text = " Cincinnati Bengals Quarter 1:<br>0 13 <br>Quarter 2<br>14 0 <br>Quarter 3<br>9 8 <br>Quarter 4<br>13 15 <br>Overtime<br>7 0"
    expect(parseBreakdown(text, "american-football", sides("Cincinnati Bengals", "Tennessee Titans", 43, 36))?.segments).toHaveLength(5)
  })
  it("drops an empty overtime and refuses empty halves in rugby", () => {
    const text = " Section Paloise First Half:<br>17 7 <br>Second Half<br>17 7 <br>Overtime<br> "
    expect(parseBreakdown(text, "rugby", sides("Section Paloise", "Stade Toulousain", 34, 14))?.segments.map((item) => item.kind)).toEqual(["half", "half"])
    expect(parseBreakdown(" Currie First Half:<br>  <br>Second Half<br>  <br>Overtime<br> ", "rugby", sides("Currie", "Hawick", 24, 29))).toBeNull()
  })
  it("keeps a blank volleyball set in its place and adds nothing after the last one", () => {
    const text = " Projekt Warsaw First:<br>20 25 <br>Second<br>25 20 <br>Third<br>25 21 <br>Forth<br><br>Fifth<br>15 7 "
    const parsed = parseBreakdown(text, "volleyball", sides("Projekt Warsaw", "Ślepsk Suwałki", 3, 2))
    expect(parsed?.segments[3]).toEqual({ kind: "set", number: 4, home: null, away: null })
    expect(parseBreakdown(" A First:<br>25 19 <br>Second<br>25 21 <br>Third<br>25 23 <br>Forth<br><br>Fifth<br>  ", "volleyball", sides("A", "B", 3, 0))?.segments).toHaveLength(3)
  })
  it("reaches the event for a finished game only", () => {
    const strResult = " A Quarters:<br>10 10 10 10<br><br>B Quarters:<br>5 5 5 5"
    const base = { ...raw, strResult, intHomeScore: "40", intAwayScore: "20" }
    expect(normalizeEvent({ ...base, strStatus: "FT" }, "basketball").breakdown?.segments).toHaveLength(4)
    expect(normalizeEvent({ ...base, strStatus: "Q4" }, "basketball").breakdown).toBeUndefined()
    expect(normalizeEvent({ ...base, strStatus: "FT" }, "football").breakdown).toBeUndefined()
  })
})

describe("live updates", () => {
  it("keeps an unmapped row in the source's words, in clock then id order", () => {
    const items = normalizeTimeline([
      { idTimeline: "20", strTimeline: "Goal", strTimelineDetail: "Normal Goal", intTime: "30", strPlayer: "X" },
      { idTimeline: "9", strTimeline: "Injury", strTimelineDetail: "Treatment on pitch", intTime: "30" },
      { idTimeline: "5", strTimeline: "Kick off", intTime: "1" },
      { idTimeline: "6", strTimeline: "" },
    ])
    expect(items.map((item) => item.id)).toEqual(["5", "9", "20"])
    expect(items[0]).toMatchObject({ kind: "other", label: "Kick off" })
    expect(items[1]).toMatchObject({ kind: "other", label: "Treatment on pitch" })
  })
  it("never calls a missed penalty a goal", () => {
    expect(normalizeTimeline([{ strTimeline: "Goal", strTimelineDetail: "Missed Penalty", intTime: "9" }])[0].kind).toBe("missed-penalty")
  })
})

describe("statistics", () => {
  it("does not turn a one-sided value into zero", () => {
    expect(normalizeStats([{ strStat: "Fouls", intHome: "9", intAway: null }])).toEqual([{ key: "fouls", home: "9", away: null }])
  })
  it("uses the source's names outside football, in its order", () => {
    const rows = normalizeStats([{ strStat: "Rebounds", intHome: "40", intAway: "38" }, { strStat: "Hits", intHome: "1", intAway: "" }, { strStat: "Empty" }], "basketball")
    expect(rows).toEqual([{ key: "rebounds", home: "40", away: "38", label: "Rebounds" }, { key: "hits", home: "1", away: null, label: "Hits" }])
  })
})

describe("motorsport classification", () => {
  it("keeps laps and grid", () => {
    const row = (position: number, driver: string, time: string) => `${position}\t3\tNetherlands ${driver}\tRed Bull\t71\t${time}\t${position + 4}\t25`
    expect(parseClassification([row(1, "One", "2:20:28.772"), row(2, "Two", "+0.799"), row(3, "Three", "+4.006")].join("\n"))?.[0]).toMatchObject({ laps: 71, grid: 5 })
  })
})

const played = (id: string, start: string, home: string, away: string, homeScore: number, awayScore: number, extra: Partial<SportEvent> = {}) => ({
  id, sportId: "football", eventType: "match", participantType: "team", status: "finished", scheduledStartUTC: start,
  participants: [{ id: null, name: home, role: "home", badgeUrl: null }, { id: null, name: away, role: "away", badgeUrl: null }],
  score: { kind: "team", home: homeScore, away: awayScore }, competition: { id: "1", name: "League", country: null }, ...extra,
}) as SportEvent

describe("form", () => {
  const match = { id: "now", scheduledStartUTC: "2026-11-05T00:00:00.000Z" }
  it("reads results from either side, newest first, up to five", () => {
    const games = [
      played("1", "2026-11-01T00:00:00.000Z", "A", "B", 2, 0),
      played("2", "2026-11-02T00:00:00.000Z", "C", "A", 3, 1),
      played("3", "2026-11-03T00:00:00.000Z", "A", "D", 1, 1),
    ]
    expect(teamForm(games, "A", match)).toEqual(["draw", "loss", "win"])
    const many = Array.from({ length: 7 }, (_, index) => played(String(index), `2026-10-0${index + 1}T00:00:00.000Z`, "A", "B", 1, 0))
    expect(teamForm(many, "A", match)).toHaveLength(5)
  })
  it("never counts this game or a later one", () => {
    const games = [played("now", "2026-11-05T00:00:00.000Z", "A", "B", 1, 0), played("x", "2026-11-06T00:00:00.000Z", "A", "B", 1, 0)]
    expect(teamForm(games, "A", match)).toEqual([])
  })
  it("leaves out a level shootout with no stated winner, and an unfinished game", () => {
    const games = [
      played("1", "2026-11-01T00:00:00.000Z", "A", "B", 0, 0, { conclusion: "penalties" }),
      played("2", "2026-11-02T00:00:00.000Z", "A", "B", 1, 0, { status: "abandoned" }),
      played("3", "2026-11-03T00:00:00.000Z", "A", "B", 0, 0, { conclusion: "penalties", shootout: { home: 4, away: 3 } }),
    ]
    expect(teamForm(games, "A", match)).toEqual(["win"])
  })
})

describe("one form calculation", () => {
  it("reads a level shootout win the same on the team page and the match page", () => {
    const games = [played("1", "2026-11-01T00:00:00.000Z", "A", "B", 1, 1, { conclusion: "penalties", shootout: { home: 3, away: 5 } })]
    expect(formByGame(games, "B")).toEqual([{ eventId: "1", result: "win" }])
    expect(teamForm(games, "B", { id: "now", scheduledStartUTC: "2026-11-05T00:00:00.000Z" })).toEqual(["win"])
  })
})

describe("provider wording on French pages", () => {
  const { stats, timelineKinds } = getDictionary("fr").match
  it("hides a stat with no term and keeps one that has a term", () => {
    const rows = normalizeStats([{ strStat: "Rebounds", intHome: 40, intAway: 38 }, { strStat: "Fouls", intHome: 3, intAway: 4 }], "basketball")
    expect(labelStats(rows, stats, "fr")).toEqual([expect.objectContaining({ key: "fouls", label: stats.fouls })])
    expect(labelStats(rows, getDictionary("en").match.stats, "en").map((row) => row.label)).toEqual(["Rebounds", "Fouls"])
  })
  it("hides an other row, and leaves rows with a term alone", () => {
    const items = normalizeTimeline([{ idTimeline: "1", strTimeline: "Goal", strTimelineDetail: "Normal Goal", intTime: "3" }, { idTimeline: "2", strTimeline: "Injury", intTime: "4" }])
    expect(labelTimeline(items, timelineKinds, "fr").map((item) => item.label)).toEqual([timelineKinds.goal])
    expect(labelTimeline(items, getDictionary("en").match.timelineKinds, "en").map((item) => item.label)).toEqual(["Goal", "Injury"])
  })
})

describe("stale match data", () => {
  const now = Date.parse("2026-11-06T12:00:00Z")
  it("only warns about a game still moving", () => {
    expect(isStaleUpdate("live", "2026-11-06T11:50:00Z", now)).toBe(true)
    expect(isStaleUpdate("live", "2026-11-06T11:58:00Z", now)).toBe(false)
    expect(isStaleUpdate("finished", "2026-11-01T00:00:00Z", now)).toBe(false)
    expect(isStaleUpdate("live", null, now)).toBe(false)
  })
})

describe("score filters", () => {
  const events = [
    played("1", "2026-11-05T00:00:00.000Z", "Arsenal", "Chelsea", 1, 0),
    played("2", "2026-11-05T00:00:00.000Z", "Lyon", "Metz", 1, 0, { competition: { id: "2", name: "Ligue 1", country: null } }),
  ]
  it("offers every competition of the day and filters by one", () => {
    const options = competitionOptions(events)
    expect(options.map((item) => item.name).sort()).toEqual(["League", "Ligue 1"])
    const key = options.find((item) => item.name === "Ligue 1")?.key
    expect(filterScores(events, { q: "", competition: key, following: null }).map((item) => item.id)).toEqual(["2"])
  })
  it("ignores a competition that is not on today, and keeps text search", () => {
    expect(filterScores(events, { q: "", competition: "football:gone", following: null })).toHaveLength(2)
    expect(filterScores(events, { q: "metz", following: null }).map((item) => item.id)).toEqual(["2"])
  })
  it("filters to followed teams and leagues from what the address carries", () => {
    const follow = followFilter({ favorites: ["Chelsea"], players: [], leagues: [] })
    expect(filterScores(events, { q: "", following: parseFollowFilter(follow.fav, follow.favl) }).map((item) => item.id)).toEqual(["1"])
    const league = followFilter({ favorites: [], players: [], leagues: [{ id: "2", name: "Ligue 1", sportId: "football" }] })
    expect(filterScores(events, { q: "", following: parseFollowFilter(league.fav, league.favl) }).map((item) => item.id)).toEqual(["2"])
    expect(parseFollowFilter(undefined, undefined)).toBeNull()
  })
  it("includes a followed player's team, and never builds an address a CDN would refuse", () => {
    expect(followFilter({ favorites: [], leagues: [], players: [{ id: "1", name: "P", team: "Lyon", sportId: "football" }] }).fav).toBe("Lyon")
    const many = Array.from({ length: 500 }, (_, index) => `Team number ${index} with a long name`)
    expect(encodeURIComponent(followFilter({ favorites: many, players: [], leagues: [] }).fav).length).toBeLessThanOrEqual(6000)
  })
})
