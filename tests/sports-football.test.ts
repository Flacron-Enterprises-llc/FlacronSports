import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cardReason, footballClock, footballDetails, footballHalves, legAggregate } from "@/lib/sports/adapters/football"
import { isStaleUpdate, labelStats, labelTimeline, normalizeStats, normalizeTimeline } from "@/lib/sports/detail"
import { getDictionary } from "@/lib/i18n"
import { clockText, livePhase } from "@/lib/sports/presentation"
import { clearFeedCache, getEvent } from "@/lib/sports/service"
import { sportFacts } from "@/lib/sports/sport-terms"
import { normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"

const t = getDictionary("en")
const fr = getDictionary("fr")

// Korean K3 League, 2026-11-07: still "HT" from the source hours after a 05:00 kick-off.
const k3: RawEvent = { idEvent: "2430220", strSport: "Soccer", strLeague: "Korean K3 League", idLeague: "4", strHomeTeam: "Changwon FC", strAwayTeam: "Gangneung Citizen", strStatus: "HT", intHomeScore: "0", intAwayScore: "1", strTimestamp: "2026-11-07T05:00:00", strTime: "05:00:00", intRound: "27", strSeason: "2026" }

describe("a stored state the source stopped updating", () => {
  it("keeps half-time while it can still be true", () => {
    expect(normalizeEvent(k3, "football", new Date("2026-11-07T05:50:00Z")).status).toBe("live")
  })
  it("stops calling a game live, and keeps the last score", () => {
    const event = normalizeEvent(k3, "football", new Date("2026-11-07T08:04:00Z"))
    expect(event.status).toBe("unknown")
    expect(event.score).toEqual({ kind: "team", home: 0, away: 1 })
  })
  it("stops listing a game with no state as upcoming", () => {
    const row = { ...k3, strStatus: "NS", intHomeScore: null, intAwayScore: null }
    expect(normalizeEvent(row, "football", new Date("2026-11-07T08:04:00Z")).status).toBe("unknown")
    expect(normalizeEvent(row, "football", new Date("2026-11-07T07:00:00Z")).status).toBe("scheduled")
  })
  it("believes the live feed however late the game runs", () => {
    expect(normalizeEvent({ ...k3, strStatus: "2H", strProgress: "71" }, "football", new Date("2026-11-07T09:00:00Z")).status).toBe("live")
  })
  it("leaves other sports on their own limit", () => {
    expect(normalizeEvent({ ...k3, strSport: "Basketball" }, "basketball", new Date("2026-11-07T08:04:00Z")).status).toBe("live")
  })
})

describe("the live minute", () => {
  const at = new Date("2026-11-07T06:00:00Z")
  const live = (strStatus: string, strProgress: string | null) => normalizeEvent({ ...k3, strStatus, strProgress }, "football", at)

  it("marks stoppage time as minutes", () => {
    expect(clockText("90+5")).toBe("90+5′")
    expect(clockText("37")).toBe("37′")
  })
  it("drops the minute while play is stopped", () => {
    expect(footballClock("HT", "45+2")).toBeNull()
    expect(live("HT", "45+2").clock).toBeUndefined()
    expect(live("2H", "71").clock).toBe("71")
  })
  it("says half-time on a card, and only the minute while the ball is in play", () => {
    expect(livePhase(live("HT", "45+2"), t)).toBe("Half-time")
    expect(livePhase(live("2H", "71"), t)).toBeNull()
    expect(livePhase(live("2H", null), t)).toBe("2nd half")
    expect(livePhase(live("ET", "105"), t)).toBe("Extra time")
  })
})

describe("match facts", () => {
  it("reads a match week, a stage and a place", () => {
    const facts = (row: Parameters<typeof footballDetails>[0]) => sportFacts({ details: footballDetails(row) }, t).map(({ label, value }) => `${label}: ${value}`)
    expect(facts({ intRound: "4", strSeason: "2026-2027", strCountry: "Spain" })).toEqual(["Round: 4", "Season: 2026-2027", "Location: Spain"])
    expect(facts({ intRound: "125" })).toEqual(["Stage: Quarter-finals"])
  })
  it("names no round whose code means different things", () => {
    for (const code of ["160", "400", "128", "0"]) expect(footballDetails({ intRound: code })).toMatchObject({ round: null, stage: null })
  })
})

describe("timeline", () => {
  const row = { idTimeline: "1", strHome: "No", intTime: "45" }

  it("leads a change with the player coming on", () => {
    const [item] = normalizeTimeline([{ ...row, strTimeline: "subst", strTimelineDetail: "Substitution 1", strPlayer: "Ola Aina", strAssist: "Daniel Muñoz" }])
    expect(item).toMatchObject({ kind: "substitution", player: "Daniel Muñoz", secondary: "Ola Aina" })
    expect(labelTimeline([item], t.match.timelineKinds, "en", { infractions: {}, situations: t.match.goalSituations, replaced: t.match.replaced })[0].secondary).toBe("replacing Ola Aina")
  })
  it("keeps an older row that names one player", () => {
    const [item] = normalizeTimeline([{ ...row, strTimeline: "subst", strTimelineDetail: "K. Charles", strPlayer: "Dominic Corness", strAssist: "" }])
    expect(item.player).toBe("Dominic Corness")
  })
  it("states a card's reason, in French too, and drops the source's NULL", () => {
    const [item] = normalizeTimeline([{ ...row, strTimeline: "Card", strTimelineDetail: "Yellow Card", strPlayer: "Raphinha", strComment: "Argument" }])
    const words = (dictionary: typeof t) => ({ infractions: {}, situations: dictionary.match.goalSituations, cardReasons: dictionary.match.cardReasons })
    expect(labelTimeline([item], t.match.timelineKinds, "en", words(t))[0].label).toBe("Yellow card · Argument")
    expect(labelTimeline([item], fr.match.timelineKinds, "fr", words(fr))[0].label).toBe("Carton jaune · Altercation")
    expect(cardReason("NULL")).toBeNull()
  })
  it("states what a video review decided", () => {
    const [item] = normalizeTimeline([{ ...row, strTimeline: "Var", strTimelineDetail: "Goal cancelled", strPlayer: "X" }])
    expect(labelTimeline([item], t.match.timelineKinds, "en", { infractions: {}, situations: t.match.goalSituations, reviews: t.match.reviews })[0].label).toBe("VAR review: goal cancelled")
  })
})

describe("statistics", () => {
  it("keeps the three the curated list dropped", () => {
    const rows = normalizeStats([{ strStat: "Shots insidebox", intHome: "14", intAway: "6" }, { strStat: "Shots outsidebox", intHome: "3", intAway: "4" }, { strStat: "Free Kicks", intHome: "9", intAway: "11" }])
    expect(labelStats(rows, t.match.stats, "en").map((item) => item.label)).toEqual(["Shots inside the box", "Shots outside the box", "Free kicks"])
    expect(labelStats(rows, fr.match.stats, "fr").map((item) => item.label)).toEqual(["Tirs dans la surface", "Tirs hors de la surface", "Coups francs"])
  })
})

describe("score by half", () => {
  const goal = (intTime: string, strHome: string, strTimelineDetail = "Normal Goal") => ({ strTimeline: "Goal", strTimelineDetail, strHome, intTime })
  const score = (home: number, away: number) => ({ kind: "team" as const, home, away })

  it("counts minute 45 as the first half, own goals for the side credited, and not a missed penalty", () => {
    expect(footballHalves([goal("45", "Yes"), goal("30", "Yes", "Own Goal"), goal("46", "No"), goal("80", "No", "Missed Penalty")], score(2, 1))?.segments).toEqual([{ kind: "half", number: 1, home: 2, away: 0 }, { kind: "half", number: 2, home: 0, away: 1 }])
  })
  it("adds extra time, from Ludogorets 3-1 Rijeka", () => {
    expect(footballHalves([goal("19", "Yes", "Penalty"), goal("71", "No"), goal("107", "Yes", "Own Goal"), goal("117", "Yes")], score(3, 1), "extra-time")?.segments.at(-1)).toEqual({ kind: "extra", number: 1, home: 2, away: 0 })
  })
  it("shows nothing when the timeline misses a goal, as Villarreal 0-6 Paris Saint-Germain's does", () => {
    expect(footballHalves(["9", "12", "13", "17", "50"].map((minute) => goal(minute, "No")), score(0, 6))).toBeNull()
  })
  it("shows nothing when one side's goals are missing", () => {
    expect(footballHalves(["4", "42", "49", "68"].map((minute) => goal(minute, "Yes")), score(4, 4), "penalties")).toBeNull()
  })
})

describe("aggregate", () => {
  const first = { idEvent: "1", idHomeTeam: "A", idAwayTeam: "B", intRound: "16", intHomeScore: "1", intAwayScore: "1", strTimestamp: "2026-03-10T20:00:00", strStatus: "FT" }
  const second = { idEvent: "2", idHomeTeam: "B", idAwayTeam: "A", intRound: "16", intHomeScore: "7", intAwayScore: "2", strTimestamp: "2026-03-18T20:00:00", strStatus: "FT" }

  it("adds both legs in the second leg's own order", () => {
    expect(legAggregate(second, [first, second])).toEqual({ home: 8, away: 3 })
  })
  it("gives the first leg none", () => {
    expect(legAggregate(first, [first, second])).toBeNull()
  })
  it("needs the first leg played, and exactly two meetings", () => {
    expect(legAggregate(second, [{ ...first, strStatus: "PST" }, second])).toBeNull()
    expect(legAggregate(second, [second])).toBeNull()
    expect(legAggregate(second, [first, second, { ...first, idEvent: "3" }])).toBeNull()
  })
  it("never reads a league phase", () => {
    expect(legAggregate({ ...second, intRound: "4" }, [{ ...first, intRound: "4" }, { ...second, intRound: "4" }])).toBeNull()
  })
})

describe("the out of date notice", () => {
  const now = new Date("2026-11-07T05:40:00Z")
  const mins = 60_000

  beforeEach(() => {
    clearFeedCache()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)
    vi.stubEnv("THESPORTSDB_API_KEY", "paid")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
  const urlOf = (input: unknown) => String(input)

  it("does not warn on a running game the live feed leaves out, because the page asks the source", async () => {
    const lookup = vi.fn(async (input: unknown) => {
      if (urlOf(input).includes("livescore")) return respond({ livescore: [] })
      return respond({ events: [urlOf(input).includes("lookupevent") ? { ...k3, intHomeScore: "1" } : k3] })
    })
    vi.stubGlobal("fetch", lookup)
    await getEvent("tsdb-2430220")
    vi.setSystemTime(now.getTime() + 20 * mins)
    const event = await getEvent("tsdb-2430220")
    expect(event?.status).toBe("live")
    expect(event?.score).toEqual({ kind: "team", home: 1, away: 1 })
    expect(isStaleUpdate(event?.status ?? "unknown", event?.sourceUpdatedAt, Date.now())).toBe(false)
  })

  it("still warns when the source cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => (urlOf(input).includes("livescore") ? respond({ livescore: [] }) : respond({ events: [k3] }))))
    await getEvent("tsdb-2430220")
    vi.setSystemTime(now.getTime() + 20 * mins)
    vi.stubGlobal("fetch", vi.fn(async () => respond({}, 500)))
    const event = await getEvent("tsdb-2430220")
    expect(event?.status).toBe("live")
    expect(isStaleUpdate(event?.status ?? "unknown", event?.sourceUpdatedAt, Date.now())).toBe(true)
  })
})
