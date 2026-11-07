// The saved answer of the second cricket source (25 matches, read on 2026-11-07), with the key removed.
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

import { cricketDataEvent, inningsSide, mergeCricketData, readCricketDataMatch, sameSides, teamKey, usableMatches, type CricketDataMatch, type RawCricketMatch } from "@/lib/sports/adapters/cricketdata"
import { afterAnswer, budgetDecision, dailyHits, fetchCurrentMatches, keepMatches, type CricketBudget } from "@/lib/sports/cricketdata"
import { clearFeedCache, getEvent, getEvents, refreshCricketData } from "@/lib/sports/service"
import type { EventScore, Innings, SportEvent } from "@/lib/sports/types"

const SAVED = JSON.parse(readFileSync(new URL("./fixtures/cricketdata-current-matches.json", import.meta.url), "utf8")) as { status: string; info: { hitsToday: number; hitsLimit: number }; data: RawCricketMatch[] }
const RAW = SAVED.data
const AT = Date.parse("2026-11-07T11:05:00Z")
const read = (prefix: string) => readCricketDataMatch(RAW.find((match) => match.id.startsWith(prefix)) as RawCricketMatch) as CricketDataMatch
const eventOf = (prefix: string) => cricketDataEvent(read(prefix), AT)
type Scored = Extract<EventScore, { kind: "innings" }>
const scoreOf = (prefix: string) => eventOf(prefix).score as Scored
const line = (innings: Innings | null | undefined) => (innings ? `${innings.runs}/${innings.wickets} (${innings.overs})` : null)

// One row per match: status, format, home, away, winner and margin as the source states them.
const EXPECTED: [string, SportEvent["status"], string | null, string | null, string | null, string | null, string | null][] = [
  ["22508d08", "finished", "t20", "83/10 (18.3)", "86/1 (9.4)", "Kathmandu Gorkhas", "9 wickets"],
  ["a8e562f2", "finished", "t20", "133/8 (20)", "149/8 (20)", "Lumbini Lions", "16 runs"],
  ["e743011d", "finished", "t20", "98/2 (11.4)", "97/9 (20)", "Lumbini Lions", "8 wickets"],
  ["aa12a4ba", "finished", "t20", "174/3 (20)", "172/7 (20)", "Biratnagar Kings", "2 runs"],
  ["d2eca8a2", "finished", "t20", "123/10 (16.3)", "219/7 (20)", "England Lions", "96 runs"],
  ["537ccc9a", "finished", "t20", "134/7 (20)", "151/10 (18.5)", "England Lions", "17 runs"],
  ["8d8e9784", "finished", "odi", "226/8 (50)", "184/9 (50)", "United Arab Emirates", "42 runs"],
  ["298fc307", "live", "odi", "76/2 (20)", "245/10 (49.4)", null, null],
  ["7b6de40a", "finished", "odi", "47/0 (3)", "42/10 (22.3)", "Afghanistan U19", "10 wickets"],
  ["8cab6ab0", "finished", "odi", "129/0 (19.1)", "128/10 (42.3)", "India U19", "10 wickets"],
  ["8073572e", "finished", "odi", "225/1 (37.3)", "224/10 (50)", "Pakistan U19", "9 wickets"],
  ["7b5135ce", "finished", "odi", "118/10 (25.5)", "231/10 (49)", "Afghanistan U19", "113 runs"],
  ["a7347ac9", "finished", "odi", "91/1 (13.5)", "88/10 (28.1)", "Sri Lanka U19", "9 wickets"],
  ["1f4f3716", "live", "t20", "94/6 (15)", "116/9 (20)", null, null],
  ["300f2828", "finished", "t20", "188/3 (20)", "152/8 (20)", "Melbourne Renegades Women", "36 runs"],
  ["9bdb29a3", "live", "first-class", null, "227", null, null],
  ["29f0a681", "live", "test", "386", "363", null, null],
  ["8ad504bb", "live", "test", "293", "504", null, null],
  ["db5cceff", "live", "first-class", "261", "539", null, null],
  ["f6f37400", "finished", "odi", "283/10 (45.5)", "357/7 (50)", "Auckland", "74 runs"],
  ["50b58369", "finished", "odi", "354/7 (50)", "152/10 (35.1)", "Wellington", "202 runs"],
  ["d25bab77", "finished", "odi", "176/4 (37)", "175/10 (43.3)", "Otago", "6 wickets"],
  ["0e3699f8", "finished", "t20", "159/7 (20)", "160/5 (20)", "Sydney Sixers Women", "1 runs"],
  ["f6bfa913", "finished", "t20", "166/10 (19)", "183/2 (20)", "Perth Scorchers Women", "17 runs"],
  ["de774f34", "finished", "t20", "170/5 (20)", "184/4 (20)", "Brisbane Heat Women", "14 runs"],
]

describe("every match in the saved answer", () => {
  it("covers all 25", () => {
    expect(RAW).toHaveLength(25)
    expect(new Set(EXPECTED.map(([prefix]) => RAW.findIndex((match) => match.id.startsWith(prefix)))).size).toBe(25)
  })

  it.each(EXPECTED)("%s reads as stated", (prefix, status, format, home, away, winner, margin) => {
    const event = eventOf(prefix)
    expect(event.id).toMatch(/^cd-[0-9a-f-]{36}$/)
    expect(event.sportId).toBe("cricket")
    expect(event.status).toBe(status)
    expect(event.details?.kind === "cricket" && event.details.format).toBe(format)
    expect(event.details?.kind === "cricket" && event.details.statusNote).toBe(RAW.find((match) => match.id.startsWith(prefix))?.status)
    const score = event.score as Scored
    expect(score.kind).toBe("innings")
    const shown = (total: Innings | null, list?: Innings[]) => (list ? String(total?.runs) : line(total))
    expect(shown(score.home, score.homeInnings)).toBe(home)
    expect(shown(score.away, score.awayInnings)).toBe(away)
    expect(score.winner).toBe(winner)
    expect(score.margin ? `${score.margin.value} ${score.margin.unit}` : null).toBe(margin)
  })

  it("puts every innings on the side its margin proves", () => {
    for (const [prefix, status] of EXPECTED) {
      const score = scoreOf(prefix)
      if (status !== "finished" || !score.margin || !score.home || !score.away) continue
      const [won, lost] = score.winner === eventOf(prefix).participants[0].name ? [score.home, score.away] : [score.away, score.home]
      if (score.margin.unit === "runs") expect(won.runs - lost.runs).toBe(score.margin.value)
      else expect(10 - (won.wickets ?? -1)).toBe(score.margin.value)
    }
  })

  it("names no source and invents nothing the source left empty", () => {
    for (const [prefix] of EXPECTED) {
      const event = eventOf(prefix)
      const details = event.details?.kind === "cricket" ? event.details : null
      expect(event.competition.id).toBeNull()
      expect(JSON.stringify({ ...event, provider: null, participants: event.participants.map((side) => side.name) })).not.toMatch(/cricapi|cricketdata/i)
      expect(details).toMatchObject({ umpires: null, city: null, country: null, spectators: null, round: null })
      for (const side of event.participants) expect(side.badgeUrl ?? "").not.toMatch(/icon512/)
    }
  })
})

describe("innings labels", () => {
  it("gives a comma label to the first side it names", () => {
    expect(inningsSide("Bangladesh,West Indies Inning 1", ["Bangladesh", "West Indies"])).toBe(0)
    expect(inningsSide("Zimbabwe A,Ireland A Inning 1", ["Zimbabwe A", "Ireland A"])).toBe(0)
    expect(inningsSide("west indies Inning 2", ["Bangladesh", "West Indies"])).toBe(1)
    expect(inningsSide("afghanistan u19 Inning 1", ["Bangladesh U19", "Afghanistan U19"])).toBe(1)
  })

  it("proves the comma rule with the trail and lead figures", () => {
    const test = scoreOf("29f0a681")
    expect(test.homeInnings?.map(line)).toEqual(["386/10 (111.5)"])
    expect(test.awayInnings?.map(line)).toEqual(["356/10 (106.4)", "7/0 (4)"])
    expect((test.home?.runs ?? 0) - (test.away?.runs ?? 0)).toBe(23)
    const afghanistan = scoreOf("8ad504bb")
    expect((afghanistan.away?.runs ?? 0) - (afghanistan.home?.runs ?? 0)).toBe(211)
    const ireland = scoreOf("db5cceff")
    expect((ireland.away?.runs ?? 0) - (ireland.home?.runs ?? 0)).toBe(278)
  })
})

describe("status from the text", () => {
  it("keeps a Test at stumps live although the source flags it ended", () => {
    const match = RAW.find((item) => item.id.startsWith("29f0a681")) as RawCricketMatch
    expect(match.matchEnded).toBe(true)
    expect(eventOf("29f0a681").status).toBe("live")
  })

  it("keeps a scored day one live although the source flags it not started, and reads the toss", () => {
    const event = eventOf("9bdb29a3")
    expect(event.status).toBe("live")
    expect(event.details?.kind === "cricket" && event.details.toss).toEqual({ side: "New Zealand A", choice: "field" })
    expect((event.score as Scored).home).toBeNull()
  })

  it("finishes a Test only on a stated result", () => {
    const stumps = RAW.find((item) => item.id.startsWith("29f0a681")) as RawCricketMatch
    expect(readCricketDataMatch({ ...stumps, status: "Bangladesh won by 120 runs" })?.status).toBe("finished")
    expect(readCricketDataMatch({ ...stumps, status: "Match drawn" })?.status).toBe("finished")
    expect(readCricketDataMatch({ ...stumps, status: "Match abandoned due to rain" })?.status).toBe("abandoned")
    expect(readCricketDataMatch({ ...stumps, status: "Day 5: Lunch Break" })?.status).toBe("live")
  })

  it("shows a live T20 chase with its state of play", () => {
    const event = eventOf("1f4f3716")
    expect(event.competition.name).toBe("Womens Big Bash League 2026")
    expect(event.details).toMatchObject({ women: true, matchLabel: "14th Match", statusNote: "Brisbane Heat Women need 23 runs in 30 balls" })
    expect((event.score as Scored).outcome).toBeUndefined()
  })

  it("keeps a rain-reduced result's overs", () => {
    const score = scoreOf("d25bab77")
    expect(score).toMatchObject({ rain: true, reducedOvers: 46, outcome: "won" })
  })

  it("reads a match with no format field from its name", () => {
    expect(eventOf("8ad504bb").details).toMatchObject({ format: "test", matchLabel: "1st Test", scheduledDays: 5 })
    expect(eventOf("db5cceff").details).toMatchObject({ format: "first-class", scheduledDays: 4 })
  })

  it("names the competition, group and season from the match name", () => {
    expect(eventOf("298fc307")).toMatchObject({ competition: { name: "ACC Mens U19 Asia Cup 2026" }, details: { group: "Group B", season: "2026", matchLabel: "6th Match" } })
    expect(eventOf("8d8e9784").details).toMatchObject({ season: "2023-27" })
    expect(eventOf("8ad504bb").competition.name).toBe("Afghanistan vs Zimbabwe in UAE, 2026")
  })

  it("shows nothing for a match not yet started", () => {
    const base = RAW.find((item) => item.id.startsWith("1f4f3716")) as RawCricketMatch
    const event = cricketDataEvent(readCricketDataMatch({ ...base, status: "Match starts at Nov 09, 08:10 GMT", score: [], matchStarted: false, matchEnded: false }) as CricketDataMatch, AT)
    expect(event.status).toBe("scheduled")
    expect(event.score).toEqual({ kind: "none" })
  })
})

describe("one game from two sources", () => {
  it("folds what one source adds, but never an age group or a women's side", () => {
    expect(sameSides(["Bangladesh Cricket", "West Indies Cricket"], ["Bangladesh", "West Indies"])).toBe("same")
    expect(sameSides(["India Cricket Women", "Australia Women"], ["India Women", "Australia Women's"])).toBe("same")
    expect(sameSides(["India U19", "Nepal U19"], ["India", "Nepal"])).toBeNull()
    expect(sameSides(["India", "Nepal"], ["India Women", "Nepal Women"])).toBeNull()
    expect(sameSides(["Canterbury", "Otago"], ["Otago", "Canterbury"])).toBe("swapped")
    expect(teamKey("India Under-19")).toBe(teamKey("India U19"))
  })

  const tsdb = (id: string, home: string, away: string, start: string): SportEvent => ({
    id, sportId: "cricket", eventType: "match", participantType: "team",
    participants: [{ id: null, name: home, role: "home", badgeUrl: null }, { id: null, name: away, role: "away", badgeUrl: null }],
    competition: { id: "1", name: "League", country: null }, scheduledStartUTC: start, status: "unknown", providerStatus: null,
    score: { kind: "none" }, venue: null, provider: { name: "x", eventId: id }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
    details: { kind: "cricket", format: "test", scheduledDays: 5, stage: null, matchLabel: "2nd Test", round: null, season: "2026", group: null, phase: null, umpires: null, dayNight: false, city: null, country: null, women: false, toss: null, spectators: null },
  })
  const all = usableMatches(RAW, AT, AT)

  it("keeps the first id and fills score, status and note", () => {
    const day = [tsdb("tsdb-1", "Bangladesh Cricket", "West Indies Cricket", "2026-11-05T03:30:00.000Z")]
    const merged = mergeCricketData(day, [], all, "2026-11-05", AT, "2026-11-07")
    const event = merged.find((item) => item.id === "tsdb-1") as SportEvent
    expect(merged.filter((item) => item.participants[0].name.startsWith("Bangladesh") && item.participants[1].name.startsWith("West Indies"))).toHaveLength(1)
    expect(event.status).toBe("live")
    expect(event.details).toMatchObject({ matchLabel: "2nd Test", statusNote: "Day 3: Stumps - West Indies trail by 23 runs" })
    expect((event.score as Scored).awayInnings?.map((item) => item.runs)).toEqual([356, 7])
  })

  it("turns a swapped game round onto the first source's sides", () => {
    const day = [tsdb("tsdb-2", "Canterbury", "Otago", "2026-11-05T00:00:00.000Z")]
    const event = mergeCricketData(day, [], all, "2026-11-05", AT, "2026-11-07")[0]
    expect(event.id).toBe("tsdb-2")
    expect(event.status).toBe("finished")
    expect(line((event.score as Scored).home)).toBe("175/10 (43.3)")
    expect((event.score as Scored).winner).toBe("Otago")
  })

  it("does not show a game again on the day before the first source files it", () => {
    const nearby = [tsdb("tsdb-2", "Canterbury", "Otago", "2026-11-05T00:00:00.000Z")]
    const merged = mergeCricketData([], nearby, all, "2026-11-04", AT, "2026-11-07")
    expect(merged.some((item) => item.participants.some((side) => side.name === "Otago"))).toBe(false)
    expect(merged.some((item) => item.participants.some((side) => side.name === "Oman"))).toBe(true)
  })

  it("gives back-to-back games between the same sides one match each", () => {
    const day = [tsdb("tsdb-3", "West Indies A", "England Lions", "2026-11-03T18:00:00.000Z"), tsdb("tsdb-4", "West Indies A", "England Lions", "2026-11-04T18:00:00.000Z")]
    const [second, third] = [mergeCricketData(day, [], all, "2026-11-03", AT, "2026-11-07")[0], mergeCricketData(day.slice(1), day.slice(0, 1), all, "2026-11-04", AT, "2026-11-07")[0]]
    expect((second.score as Scored).margin?.value).toBe(17)
    expect((third.score as Scored).margin?.value).toBe(96)
  })

  it("adds a game the first source does not list, and carries an unfinished Test to its later days", () => {
    const today = mergeCricketData([], [], all, "2026-11-07", AT, "2026-11-07")
    expect(today.map((event) => event.participants.map((side) => side.name).join(" v ")).sort()).toEqual([
      "Afghanistan U19 v Malaysia U19",
      "Afghanistan v Zimbabwe",
      "Bangladesh v West Indies",
      "Brisbane Heat Women v Hobart Hurricanes Women",
      "Melbourne Renegades Women v Adelaide Strikers Women",
      "New Zealand A v India A",
      "Sri Lanka U19 v Bangladesh U19",
      "Zimbabwe A v Ireland A",
    ])
    expect(today.find((event) => event.participants[0].name === "Bangladesh")?.details).toMatchObject({ matchDay: 3 })
    expect(mergeCricketData([], [], all, "2026-11-09", AT, "2026-11-07").some((event) => event.participants[0].name === "Bangladesh")).toBe(false)
  })

  it("drops an old state of play but keeps old results", () => {
    const later = usableMatches(RAW, AT, AT + 4 * 3_600_000)
    expect(later.every((match) => match.status === "finished" || match.status === "abandoned")).toBe(true)
    expect(later).toHaveLength(19)
  })
})

describe("daily allowance", () => {
  const at = (iso: string) => new Date(iso)

  it("reads the daily figure from the environment", () => {
    expect(dailyHits(undefined)).toBe(80)
    expect(dailyHits("")).toBe(80)
    expect(dailyHits("40")).toBe(40)
    expect(dailyHits("-3")).toBe(80)
    expect(dailyHits("ten")).toBe(80)
  })

  it("spreads 80 calls over a day of 15 minute runs, one a run at most", () => {
    let budget: CricketBudget | null = null
    let calls = 0
    let longestGap = 0
    let last = 0
    for (let tick = 0; tick < 96; tick += 1) {
      const now = new Date(Date.parse("2026-11-07T00:00:00Z") + tick * 15 * 60_000)
      const decision = budgetDecision(budget, now, 80)
      budget = decision.budget
      if (!decision.call) continue
      calls += 1
      if (last) longestGap = Math.max(longestGap, now.getTime() - last)
      last = now.getTime()
      budget = afterAnswer({ ...budget, used: budget.used + 1, lastAt: now.getTime() }, { hitsToday: 10 + calls, hitsLimit: 100 })
    }
    expect(calls).toBe(80)
    expect(longestGap).toBe(30 * 60_000)
  })

  it("never makes up missed runs in a burst", () => {
    const saved: CricketBudget = { day: "2026-11-07", used: 2, lastAt: Date.parse("2026-11-07T00:15:00Z"), hitsToday: 60, hitsLimit: 100, stopped: false }
    const noon = at("2026-11-07T12:00:00Z")
    const first = budgetDecision(saved, noon, 80)
    expect(first.call).toBe(true)
    const again = budgetDecision({ ...first.budget, used: 3, lastAt: noon.getTime() }, at("2026-11-07T12:01:00Z"), 80)
    expect(again).toMatchObject({ call: false, reason: "spacing" })
  })

  it("stops for the day five short of the source's limit, and starts again the next day", () => {
    const stopped = afterAnswer({ day: "2026-11-07", used: 30, lastAt: 0, hitsToday: null, hitsLimit: null, stopped: false }, { hitsToday: 95, hitsLimit: 100 })
    expect(stopped.stopped).toBe(true)
    expect(budgetDecision(stopped, at("2026-11-07T23:00:00Z"), 80)).toMatchObject({ call: false, reason: "daily_limit" })
    expect(budgetDecision(stopped, at("2026-11-08T00:00:00Z"), 80).call).toBe(true)
    expect(afterAnswer({ ...stopped, stopped: false }, { hitsToday: 94, hitsLimit: 100 }).stopped).toBe(false)
    expect(afterAnswer({ ...stopped, stopped: false }, null, true).stopped).toBe(true)
  })

  it("keeps finished results that drop off the list, never an unfinished game", () => {
    const finished = (match: RawCricketMatch) => readCricketDataMatch(match)?.status === "finished"
    const kept = keepMatches(RAW, RAW.slice(0, 3), at("2026-11-07T12:00:00Z"), finished)
    expect(kept.some((match) => match.id.startsWith("1f4f3716"))).toBe(false)
    expect(kept.some((match) => match.id.startsWith("de774f34"))).toBe(true)
    expect(keepMatches(RAW, [], at("2026-12-01T00:00:00Z"), finished)).toHaveLength(0)
  })
})

describe("the scheduled refresh", () => {
  const KEY = "test-cricket-key-0000"
  const answer = async () => new Response(JSON.stringify({ apikey: KEY, ...SAVED }), { status: 200 })

  beforeEach(() => {
    clearFeedCache()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(AT)
    vi.stubEnv("CRICKETDATA_API_KEY", KEY)
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] }), { status: 200 }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("does nothing without a key", async () => {
    vi.stubEnv("CRICKETDATA_API_KEY", "")
    const fetcher = vi.fn(answer)
    expect(await refreshCricketData(new Date(AT), fetcher)).toEqual({ skipped: "not_configured" })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("stores one answer, keeps the key out of it, and feeds the cricket day and match page", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const fetcher = vi.fn(answer)
    const result = await refreshCricketData(new Date(AT), fetcher)
    expect(result).toMatchObject({ matches: 25, hitsToday: 58, hitsLimit: 100, stopped: false })
    expect(await refreshCricketData(new Date(AT + 60_000), fetcher)).toEqual({ skipped: "spacing" })
    expect(fetcher).toHaveBeenCalledTimes(1)

    const feed = await getEvents({ date: "2026-11-07", sport: "cricket" })
    expect(feed.events.filter((event) => event.id.startsWith("cd-"))).toHaveLength(8)
    expect(JSON.stringify(feed)).not.toContain(KEY)
    const live = await getEvent("cd-1f4f3716-c5f2-44e7-9a35-056e63a2b1cf")
    expect(live?.status).toBe("live")
    expect(JSON.stringify(errors.mock.calls)).not.toContain(KEY)
    errors.mockRestore()
  })

  it("fails without the address or key in the error, and counts the call", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      throw new Error(`connect failed ${String(url)}`)
    })
    const failure = await refreshCricketData(new Date(AT), fetcher as typeof fetch).catch((error: Error) => error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).not.toContain(KEY)
    expect((failure as Error).message).not.toMatch(/http/)
    expect(await refreshCricketData(new Date(AT + 60_000), fetcher as typeof fetch)).toEqual({ skipped: "spacing" })
  })

  it("stops for the day when the source refuses on its limit", async () => {
    const refused = await fetchCurrentMatches(KEY, async () => new Response(JSON.stringify({ apikey: KEY, status: "failure", reason: "hits today exceeded hits limit" }), { status: 200 }))
    expect(refused).toMatchObject({ ok: false, limitReached: true, matches: [] })
    expect(JSON.stringify(refused)).not.toContain(KEY)
  })
})
