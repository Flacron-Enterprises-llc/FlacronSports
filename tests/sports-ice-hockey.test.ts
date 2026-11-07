import { describe, expect, it } from "vitest"
import { hockeyCancelUnconfirmed, hockeyCardTimeline, hockeyPeriods, hockeyRecord, hockeyTimelineShort } from "@/lib/sports/adapters/ice-hockey"
import { calculateTable } from "@/lib/sports/calculated"
import { basicProfile } from "@/lib/sports/compare"
import { recordFor } from "@/lib/sports/compare-rows"
import { labelTimeline, normalizeTimeline } from "@/lib/sports/detail"
import { getDictionary } from "@/lib/i18n"
import { liveClock, livePhase } from "@/lib/sports/presentation"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

// Row shapes as the provider sent them on 7 November 2026.
const nhl = (over: Partial<RawEvent>): RawEvent => ({
  idEvent: "2591738", idLeague: "4380", strLeague: "NHL", strSport: "Ice Hockey", strHomeTeam: "Columbus Blue Jackets", strAwayTeam: "Dallas Stars",
  strTimestamp: "2026-11-06T00:00:00", dateEvent: "2026-11-06", strTime: "00:00:00", strStatus: "FT", strPostponed: "no", intHomeScore: "2", intAwayScore: "1", ...over,
})
const now = new Date("2026-11-07T09:00:00Z")

// 2591738, Columbus 2-1 Dallas after a shootout: two goals in the third, none after, and no shootout rows.
const shootoutRows = [
  { strTimeline: "Penalty", strTimelineDetail: "Holding", strHome: "No", strPlayer: "Tyler Myers", strAssist: "", intTime: "1", strPeriod: "P1", idTimeline: "1980310" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "No", strPlayer: "Mikko Rantanen", strAssist: "Wyatt Johnston", intTime: "6", strPeriod: "P3", idTimeline: "1980315" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "Yes", strPlayer: "Zach Werenski", strAssist: "Kent Johnson", intTime: "16", strPeriod: "P3", idTimeline: "1980316" },
]
// 2591739, Islanders 3-5 Carolina: the feed lists two Islanders goals for three, with an empty-net goal last.
const shortRows = [
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "No", strPlayer: "Logan Stankoven", strAssist: "Jackson Blake", intTime: "0", strPeriod: "P1", idTimeline: "1980297" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "No", strPlayer: "Jesperi Kotkaniemi", strAssist: "Jordan Martinook", intTime: "3", strPeriod: "P1", idTimeline: "1980298" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "Yes", strPlayer: "Mitchell Chaffee", strAssist: "Matthew Schaefer", intTime: "3", strPeriod: "P2", idTimeline: "1980300" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "Yes", strPlayer: "Brayden Schenn", strAssist: "", intTime: "5", strPeriod: "P2", idTimeline: "1980301" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "No", strPlayer: "Andrei Svechnikov", strAssist: "Sebastian Aho", intTime: "6", strPeriod: "P2", idTimeline: "1980302" },
  { strTimeline: "Goal", strTimelineDetail: "", strHome: "No", strPlayer: "William Carrier", strAssist: "Andrei Svechnikov", intTime: "14", strPeriod: "P3", idTimeline: "1980308" },
  { strTimeline: "Goal", strTimelineDetail: "Empty net", strHome: "No", strPlayer: "Jalen Chatfield", strAssist: "", intTime: "19", strPeriod: "P3", idTimeline: "1980309" },
]

describe("ice hockey games", () => {
  it("reads a shootout and its periods, with a scoreless overtime", () => {
    const event = normalizeEvent(nhl({ strStatus: "AP" }), "ice-hockey", now)
    expect(event).toMatchObject({ status: "finished", conclusion: "shootout", score: { kind: "team", home: 2, away: 1 } })
    expect(hockeyPeriods(shootoutRows, event.score, event.conclusion)?.segments.map((item) => [item.kind, item.home, item.away])).toEqual([["period", 0, 0], ["period", 0, 0], ["period", 1, 1], ["overtime", 0, 0]])
    expect(hockeyTimelineShort(shootoutRows, event.score, event.conclusion)).toBe(false)
    expect(hockeyCardTimeline(event)).toBe(true)
  })

  it("gives no periods when the timeline falls short of the score, and says the list is partial", () => {
    const event = normalizeEvent(nhl({ idEvent: "2591739", intHomeScore: "3", intAwayScore: "5" }), "ice-hockey", now)
    expect(hockeyPeriods(shortRows, event.score, event.conclusion)).toBeNull()
    expect(hockeyTimelineShort(shortRows, event.score, event.conclusion)).toBe(true)
  })

  it("names empty-net goals and every infraction seen, and drops a penalty's repeated name", () => {
    const t = getDictionary("fr")
    const rows = [...shortRows.slice(-1), { strTimeline: "Penalty", strTimelineDetail: "Instigator penalty", strHome: "Yes", strPlayer: "Timo Meier", strAssist: "Timo Meier", intTime: "2", strPeriod: "P2", idTimeline: "1980283" }, { strTimeline: "Penalty", strTimelineDetail: "Holding the stick", strHome: "Yes", strPlayer: "Alexandre Texier", strAssist: "", intTime: "19", strPeriod: "P1", idTimeline: "1980210" }]
    const items = labelTimeline(normalizeTimeline(rows, "ice-hockey"), t.match.timelineKinds, "fr", { infractions: t.match.infractions, situations: t.match.goalSituations, assist: t.match.assist })
    expect(items.map((item) => [item.period, item.player, item.label, item.secondary])).toEqual([
      ["P1", "Alexandre Texier", `${t.match.timelineKinds.infraction}: Avoir retenu le bâton`, null],
      ["P2", "Timo Meier", `${t.match.timelineKinds.infraction}: Instigateur`, null],
      ["P3", "Jalen Chatfield", `${t.match.timelineKinds.goal} · Dans le filet désert`, null],
    ])
  })

  it("shows the live period and its minute, and no minute in an intermission or a shootout", () => {
    const t = getDictionary("en")
    const at = (strStatus: string, strProgress: string | null) => normalizeEvent(nhl({ strTimestamp: "2026-11-07T07:30:00", strStatus, strProgress, intHomeScore: "1", intAwayScore: "1" }), "ice-hockey", now)
    const running = at("P3", "18")
    expect([livePhase(running, t), liveClock(running, livePhase(running, t))]).toEqual(["P3", "18′"])
    for (const [code, phase] of [["BT", "Break"], ["SO", "Shootout"], ["PT", "Shootout"]]) {
      const stopped = at(code, "20")
      expect(stopped.status).toBe("live")
      expect([livePhase(stopped, t), stopped.clock]).toEqual([phase, undefined])
    }
    expect(livePhase(at("OT", "4"), t)).toBe("OT")
    expect(livePhase(at("P4", "4"), t)).toBe("OT")
  })

  it("lets a live state outlast eight hours only as unconfirmed, keeping the last score, even at midnight UTC", () => {
    for (const code of ["P2", "BT", "OT", "SO"]) {
      const event = normalizeEvent(nhl({ strStatus: code, intHomeScore: "3", intAwayScore: "2" }), "ice-hockey", new Date("2026-11-06T08:30:00Z"))
      expect(event).toMatchObject({ status: "unknown", score: { kind: "team", home: 3, away: 2 } })
      expect(event.clock).toBeUndefined()
    }
    expect(normalizeEvent(nhl({ strStatus: "P2" }), "ice-hockey", new Date("2026-11-06T07:30:00Z")).status).toBe("live")
  })

  it("reads the source's season-end cancellations as fixtures, and a near one as cancelled", () => {
    const april = normalizeEvent(nhl({ idEvent: "2592752", strTimestamp: "2027-04-02T00:00:00", dateEvent: "2027-04-02", strStatus: "CANC", intHomeScore: null, intAwayScore: null }), "ice-hockey", now)
    expect(april).toMatchObject({ status: "scheduled", score: { kind: "none" } })
    expect(normalizeEvent(nhl({ strTimestamp: "2026-11-12T18:00:00", strStatus: "CANC", intHomeScore: null, intAwayScore: null }), "ice-hockey", now).status).toBe("canceled")
    expect(hockeyCancelUnconfirmed(null, now)).toBe(false)
  })
})

describe("ice hockey records", () => {
  const game = (home: string, away: string, homeScore: number, awayScore: number, strStatus: string, day: number): RawEvent =>
    nhl({ idEvent: `${home}-${away}-${day}`, strHomeTeam: home, strAwayTeam: away, intHomeScore: String(homeScore), intAwayScore: String(awayScore), strStatus, dateEvent: `2026-10-${String(day).padStart(2, "0")}`, strTimestamp: `2026-10-${String(day).padStart(2, "0")}T23:00:00` })

  it("reads won-lost-OT losses on Compare", () => {
    const events = [game("Carolina", "Boston", 3, 2, "AOT", 1), game("Boston", "Carolina", 4, 1, "FT", 2), game("Carolina", "Boston", 2, 1, "AP", 3), game("Boston", "Carolina", 2, 3, "AP", 4)].map((raw) => normalizeEvent(raw, "ice-hockey", now))
    const boston = basicProfile("Boston", events, [])
    expect(recordFor(boston.record, "ice-hockey")).toBe("1-0-3")
    expect(recordFor(basicProfile("Carolina", events, []).record, "ice-hockey")).toBe("3-1-0")
    expect(hockeyRecord(13, 3, 2)).toBe("13-3-2")
  })

  it("ranks a loss after regulation above one in it", () => {
    // Every side wins three of six, but Bravo's losses all come after regulation.
    const teams = ["Alpha", "Bravo", "Charlie", "Delta"]
    const rows: RawEvent[] = []
    let day = 1
    for (const [winner, loser, status] of [
      ["Alpha", "Charlie", "FT"], ["Alpha", "Delta", "FT"], ["Bravo", "Alpha", "FT"], ["Delta", "Alpha", "FT"], ["Charlie", "Alpha", "FT"],
      ["Bravo", "Charlie", "FT"], ["Bravo", "Delta", "FT"], ["Alpha", "Bravo", "AOT"], ["Charlie", "Bravo", "AP"], ["Delta", "Bravo", "AOT"],
      ["Charlie", "Delta", "FT"], ["Delta", "Charlie", "FT"],
    ] as const) rows.push(game(winner, loser, 3, 2, status, day++))
    const table = calculateTable(rows, "ice-hockey", "4380", "NHL", now)
    expect(table?.rows.map((row) => [row.team, row.won, row.lost, row.overtimeLosses])).toEqual(expect.arrayContaining([["Alpha", 3, 3, 0], ["Bravo", 3, 0, 3]]))
    expect(table?.rows[0].team).toBe("Bravo")
    expect(teams.every((team) => table?.rows.some((row) => row.team === team))).toBe(true)
  })
})

describe("ice hockey title order", () => {
  it("turns the scores of a row titled away first, as the real result proves", () => {
    // 2591468: Detroit beat Buffalo 3-2 in overtime, but the row gives Buffalo, its home field, the 3.
    const row = nhl({ idEvent: "2591468", strEvent: "Detroit Red Wings vs Buffalo Sabres", strHomeTeam: "Buffalo Sabres", strAwayTeam: "Detroit Red Wings", intHomeScore: "3", intAwayScore: "2", strStatus: "AOT" })
    const event = normalizeEvent(row, "ice-hockey", now)
    expect(event.participants.map((side) => side.name)).toEqual(["Buffalo Sabres", "Detroit Red Wings"])
    expect(event.score).toEqual({ kind: "team", home: 2, away: 3 })
    expect(recordFor(basicProfile("Detroit Red Wings", [event], []).record, "ice-hockey")).toBe("1-0-0")
    expect(normalizeEvent(nhl({ strEvent: "Columbus Blue Jackets vs Dallas Stars" }), "ice-hockey", now).score).toEqual({ kind: "team", home: 2, away: 1 })
  })
})
