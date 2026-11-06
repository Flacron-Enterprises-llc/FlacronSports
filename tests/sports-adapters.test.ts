// One fixture per layout in the field inventories. Names are invented; the punctuation,
// tabs, line ends and field placement are the provider's own.
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })
vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))
vi.mock("@/components/account/prefs-provider", async () => {
  const { DEFAULT_PREFERENCES } = await import("@/lib/me/preferences-defaults")
  return { usePreferences: () => ({ prefs: { ...DEFAULT_PREFERENCES, spoilerMode: true, favorites: [], timeZone: "UTC" }, signedIn: false, update: async () => true }) }
})
vi.mock("@/lib/use-locale", async () => {
  const { getDictionary } = await import("@/lib/i18n")
  return { useLocale: () => ({ locale: "en", t: getDictionary("en"), href: (path: string) => path }) }
})

import { EventCard } from "@/components/sports/event-card"
import { SportFacts, SportStatistics, SportUpdates } from "@/components/sports/sport-sections"
import { getDictionary } from "@/lib/i18n"
import { cricketFormat, matchSide, readCricketText, readInningsLines, readTwoInnings } from "@/lib/sports/adapters/cricket"
import { boutsFromRows, parseCard, parseCombatResult } from "@/lib/sports/adapters/combat"
import { parseRace, raceFromRows, sessionOf } from "@/lib/sports/adapters/motorsport"
import { parseSetRun, parseTennisDraw, parseTennisResult, splitTitle, tennisRound } from "@/lib/sports/adapters/tennis"
import { inningsLine, resultLine, rowValues } from "@/lib/sports/presentation"
import { resultFacts, sportChip, sportFacts, sportSteps, weightClassText } from "@/lib/sports/sport-terms"
import { isCovered, normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"
import type { EventScore, SportEvent } from "@/lib/sports/types"

const NOW = new Date("2026-11-07T12:00:00Z")
const t = getDictionary("en")
const fr = getDictionary("fr")

const match = (extra: Partial<RawEvent>): RawEvent => ({
  idEvent: "1", strSport: "Cricket", strLeague: "One Day International Series", idLeague: "4801", strEvent: "North Cricket vs South Cricket", strHomeTeam: "North Cricket", strAwayTeam: "South Cricket",
  strTimestamp: "2026-10-01T08:00:00", strTime: "08:00:00", dateEvent: "2026-10-01", strStatus: "FT", ...extra,
})
const cricket = (extra: Partial<RawEvent>) => normalizeEvent(match(extra), "cricket", NOW)
const innings = (event: SportEvent) => event.score as Extract<EventScore, { kind: "innings" }>

describe("cricket format", () => {
  it.each([
    ["ICC World Test Championship", "test"], ["International Test Match Series", "test"], ["English County Championship Division 1", "first-class"], ["Sheffield Shield", "first-class"],
    ["One Day International Series", "odi"], ["Cricket World Cup", "odi"], ["Womens Cricket World Cup", "odi"], ["ICC Champions Trophy", "odi"], ["ICC Mens T20 World Cup", "t20"], ["ICC Womens T20 World Cup", "t20"],
    ["Twenty20 International Series", "t20"], ["Australian Big Bash League", "t20"], ["English t20 Blast", "t20"], ["Indian Premier League", "t20"], ["SA20", "t20"], ["The Hundred", "hundred"], ["The Hundred Women", "hundred"],
  ])("reads %s as %s", (league, format) => expect(cricketFormat(league)).toBe(format))
  it("leaves an unknown competition without a format", () => expect(cricketFormat("Harbor Cup")).toBeNull())
})

describe("cricket side names", () => {
  const sides = ["Gujarat Titans", "Royal Challengers Bangalore"]
  it.each([
    ["GT", sides, 0], ["RCB", sides, 1], ["Hurricanes", ["Hobart Hurricanes", "Melbourne Stars"], 0], ["SUS", ["Sussex", "Hampshire"], 0], ["WARKS", ["Warwickshire", "Essex"], 0], ["PBKS", ["Punjab Kings", "Delhi Capitals"], 0],
    ["India", ["India Cricket Women", "Harbor Cricket Women"], 0], ["SL Women", ["Scotland Cricket Women", "Sri Lanka Cricket Women"], 1], ["Somerset", ["Yorkshire Vikings", "Somerset t20"], 1], ["NW Warriors", ["Munster Reds", "North West Warriors"], 1],
    ["S Paschim", ["Sudurpaschim Royals", "Chitwan Rhinos"], 0], ["Gallants", ["Colombo Kaps", "Galle Marvels"], 1], ["Rawalpindiz", ["Pindiz", "Islamabad United"], 0], ["Scorchers XI", ["Guyana Amazon Warriors", "Perth Scorchers"], 1],
  ])("matches %s", (said, list, index) => expect(matchSide(said, list as string[])).toBe(index))
  it("refuses to guess between two that fit", () => expect(matchSide("Stars", ["Melbourne Stars", "Sydney Stars"])).toBeNull())
  it("refuses a name that fits neither", () => expect(matchSide("Warwickshire", ["Northants Steelbacks", "Birmingham Bears"])).toBeNull())
})

describe("cricket result text", () => {
  const sides = ["North Cricket", "South Cricket"]
  it.each([
    ["South won by 7 wickets (with 8 balls remaining)", "wickets", 7, 8],
    ["North won by 47 runs", "runs", 47, undefined],
    ["South won by 5 wickets.", "wickets", 5, undefined],
    ["South won by 2 wickets (with 1 ball remaining)", "wickets", 2, 1],
    ["South won by 6 wickets (42 balls left)", "wickets", 6, 42],
    ["North won by 1 wkt", "wickets", 1, undefined],
    ["North beat South by 8 wickets\r\n1st T20I, Harbor Oval\r\nNorth win by 8 wickets (32 balls remaining)", "wickets", 8, 32],
    ["North 406 for 2 (Rook 223*, Vale 101) beat South 405 for 7 (Ash 114; Reed 2-65) by eight wickets. Harbor, 30 Sep 2026.", "wickets", 8, undefined],
  ])("reads %s", (text, unit, value, balls) => {
    const reading = readCricketText(text, sides)
    expect(reading).toMatchObject({ outcome: "won", margin: { unit, value } })
    expect(reading.ballsLeft ?? undefined).toBe(balls)
  })
  it("names the winner in a side's short name", () => expect(readCricketText("South won by 3 runs", sides).winner).toBe("South Cricket"))
  it("reads the DLS method in each spelling", () => {
    for (const text of ["North won by 3 runs (DLS method)", "North won by 53 runs (DLS Method).", "South won by 5 wickets (D/L method) to take a 1-0 lead."]) expect(readCricketText(text, sides).method).toBe("dls")
  })
  it("reads rain, a reduced match and a revised target", () => {
    const reading = readCricketText("North 185 all out (40.2 overs); South 143/5 (22.4 overs, D/L revised target from 32 overs). South won by 5 wickets (D/L method), rain-affected.", sides)
    expect(reading).toMatchObject({ rain: true, revisedOvers: 32, outcome: "won", winner: "South Cricket" })
    expect(readCricketText("5th T20I, Harbor Oval - ABANDONED due to rain. Reduced to 9 overs/side; South won toss, chose to field.", sides)).toMatchObject({ outcome: "no-result", reducedOvers: 9, rain: true, toss: { side: "South Cricket", choice: "field" } })
  })
  it.each(["No result", "No Result.", "No result (abandoned with a toss)", "Match abandoned without a ball bowled"])("reads %s as no result", (text) => expect(readCricketText(text, sides).outcome).toBe("no-result"))
  it("does not take a tied series for a tied match", () => expect(readCricketText("the 5-match series finished tied 2-2", sides).outcome).toBeNull())
  it("reads drawn and tied", () => {
    expect(readCricketText("Match drawn\r\nNOR 731\r\nSOU 422 & 127/5", sides).outcome).toBe("drawn")
    expect(readCricketText("Match tied", sides).outcome).toBe("tied")
  })
  it("reads the toss and player of the match in both cases", () => {
    expect(readCricketText("North won the toss and elected to bat.\r\nNorth won by 21 runs\r\nPlayer of the match: Ben Reed (North)", sides)).toMatchObject({ toss: { side: "North Cricket", choice: "bat" }, playerOfMatch: "Ben Reed" })
    expect(readCricketText("Venue: Harbor Oval\r\nPlayer of the Match: Ari Stone", sides).playerOfMatch).toBe("Ari Stone")
  })
  it("reads a margin by an innings", () => {
    expect(readCricketText("North won by an innings and 79 runs", sides)).toMatchObject({ byInnings: true, margin: { value: 79, unit: "runs" } })
  })
})

describe("cricket innings lines", () => {
  const sides = ["North Cricket", "South Cricket"]
  it.each([
    ["North 351/7 (50 overs); South 352/5 (48.2 overs). South won by 5 wickets.", [351, 352], ["50", "48.2"], [7, 5]],
    ["North 180/5 (20 overs)\r\nSouth 181/6 (19.5 overs)\r\nSouth won by 4 wickets", [180, 181], ["20", "19.5"], [5, 6]],
    ["South beat North by 8 wickets\r\n1st T20I\r\nNorth 171 all out (19.1 ov) - Ash 56; Reed 3-31\r\nSouth 172/2 (14.4 ov)", [171, 172], ["19.1", "14.4"], [10, 2]],
    ["2nd T20I: North 249/5 (20 overs) vs South 252/4 (18.3 overs). South won by 6 wickets.", [249, 252], ["20", "18.3"], [5, 4]],
    ["South 174/5 (20 overs; R Ash 80, S Reed 23; M Moss 1-16). North 177/6 (19 overs; R Vale 48). North won by 4 wickets (6 balls remaining).", [177, 174], ["19", "20"], [6, 5]],
  ])("reads %s", (text, runs, overs, wickets) => {
    const lines = readInningsLines(text, sides, runs)
    expect(lines.map((line) => line?.overs)).toEqual(overs)
    expect(lines.map((line) => line?.wickets)).toEqual(wickets)
  })
  it("reads wickets from a scorecard sentence with no overs", () => {
    expect(readInningsLines("South 322 for 9 (Ash 74) beat North 145 for 4 (Reed 71*) by 45 runs", sides, [145, 322]).map((line) => line?.wickets)).toEqual([4, 9])
  })
  it("will not read a line that lacks the side's own runs", () => {
    expect(readInningsLines("North 99/1 (10 overs)", sides, [100, null])[0]).toBeNull()
  })
})

describe("two-innings scorecards", () => {
  const sides = ["Sussex", "Hampshire"]
  it.each([
    ["SUS 244 & 319/9d\r\nHAM 128 & 238", [563, 366], [2, 2]],
    ["SUS  358 & 76/3\r\nHAM 240 & 193", [434, 433], [2, 2]],
    ["SUS 505\r\nHAM129 & 351/6 f/o", [505, 480], [1, 2]],
    ["SUS 390\r\nHAM 171 & 113f/o", [390, 284], [1, 2]],
  ])("reads %s", (text, totals, count) => expect(readTwoInnings(text, sides, totals).map((list) => list?.length)).toEqual(count))
  it("keeps declarations and the follow-on", () => {
    const [home, away] = readTwoInnings("SUS 244 & 319/9d\r\nHAM 171 & 113f/o", sides, [563, 284])
    expect(home?.[1]).toMatchObject({ runs: 319, wickets: 9, declared: true })
    expect(away?.[1]).toMatchObject({ runs: 113, followOn: true })
  })
  it("rejects innings that do not add up to the total", () => {
    expect(readTwoInnings("SUS 244 & 319/9d", sides, [100, null])[0]).toBeNull()
  })
})

describe("cricket events", () => {
  it("shows a county match by its innings, as the feed puts them in the description", () => {
    const event = cricket({ strLeague: "English County Championship Division 1", strEvent: "Hampshire vs Sussex", strHomeTeam: "Hampshire", strAwayTeam: "Sussex", strStatus: "", intHomeScore: "366", intAwayScore: "563", strDescriptionEN: "Sussex won by 197 runs\r\nSUS 244 & 319/9d\r\nHAM 128 & 238" })
    expect(event.status).toBe("finished")
    expect(rowValues(event)).toEqual(["128 & 238", "244 & 319/9d"])
    expect(innings(event)).toMatchObject({ winner: "Sussex", margin: { value: 197, unit: "runs" } })
    expect(event.details).toMatchObject({ format: "first-class", scheduledDays: 4 })
  })
  it("shows a Test with totals only, labelled as totals, when no innings are listed", () => {
    expect(innings(cricket({ strLeague: "International Test Match Series", intHomeScore: "574", intAwayScore: "403", strStatus: "" }))).toMatchObject({ totalsOnly: true, home: { runs: 574 } })
  })
  it("drops a Test's numbers when they contradict the innings win, and keeps the win", () => {
    const score = innings(cricket({ strLeague: "International Test Match Series", intHomeScore: "371", intAwayScore: "121", strStatus: "", strDescriptionEN: "North won by an innings and 114 runs" }))
    expect(score).toMatchObject({ home: null, away: null, winner: "North Cricket", byInnings: true })
    expect(score.totalsOnly).toBeUndefined()
  })
  it("leaves a Test with nothing stated without any score", () => {
    const event = cricket({ strLeague: "ICC World Test Championship", strStatus: null, strTimestamp: "2026-11-05T00:00:00" })
    expect(event.score).toEqual({ kind: "none" })
    expect(event.details).toMatchObject({ format: "test", scheduledDays: 5 })
  })
  it("reads match label, stage, day/night and venue facts", () => {
    expect(cricket({ strDescriptionEN: "2022/2023 Test Series\r\n3rd Test" }).details).toMatchObject({ matchLabel: "3rd Test" })
    expect(cricket({ intRound: "200", strDescriptionEN: "Night Match" }).details).toMatchObject({ stage: "final", dayNight: true, round: null })
    expect(cricket({ intRound: "150" }).details).toMatchObject({ stage: "semi-final" })
    expect(cricket({ intRound: "160", strDescriptionEN: "Night Match - Eliminator 1" }).details).toMatchObject({ stage: "eliminator" })
    expect(cricket({ intRound: "160", strDescriptionEN: "Night Match\r\nQualifier 2" }).details).toMatchObject({ stage: "qualifier" })
    expect(cricket({ intRound: "7", strCity: "Harbor", strCountry: "Atlantis", intSpectators: "55018" }).details).toMatchObject({ round: 7, city: "Harbor", country: "Atlantis", spectators: 55018 })
  })
  it("takes wickets from the field when given and from the text when not", () => {
    expect(innings(cricket({ intHomeScore: "181", intAwayScore: "180", intHomeScoreExtra: "8", strResult: "North 181/7 (19 overs)" })).home).toMatchObject({ wickets: 8, overs: "19" })
  })
  it("keeps a side that batted when the match was abandoned", () => {
    const event = cricket({ strStatus: "ABD", intHomeScore: "118", intHomeScoreExtra: "5" })
    expect(event.status).toBe("abandoned")
    expect(innings(event)).toMatchObject({ home: { runs: 118, wickets: 5 }, away: null })
  })
  it("words the outcome in both languages", () => {
    const drawn = cricket({ strResult: "Match drawn", intHomeScore: "100", intAwayScore: "90" })
    expect(resultLine(drawn, t)).toContain("Match drawn")
    expect(resultLine(drawn, fr)).toContain("Match nul")
    const big = cricket({ strResult: "North won by an innings and 79 runs", intHomeScore: "372", intAwayScore: "293", strLeague: "English County Championship Division 1" })
    expect(resultLine(big, t)).toContain("won by an innings and 79 runs")
    expect(resultLine(big, fr)).toContain("par une manche et 79")
  })
  it("reads two innings on one line", () => {
    expect(inningsLine([{ runs: 244, wickets: null, overs: null }, { runs: 319, wickets: 9, overs: null, declared: true }], null)).toBe("244 & 319/9d")
  })
})

const tennisRow = (extra: Partial<RawEvent>): RawEvent => ({ idEvent: "2", strSport: "Tennis", strLeague: "ATP World Tour", idLeague: "4464", strEvent: "Harbor Open Rook vs Vale", strTimestamp: "2026-10-30T00:00:00", strTime: "00:00:00", dateEvent: "2026-10-30", strSeason: "2026", strCountry: "Atlantis", ...extra })
const tennis = (extra: Partial<RawEvent>) => normalizeEvent(tennisRow(extra), "tennis", NOW)

describe("tennis", () => {
  it("splits a bare title, which is how nearly every match arrives", () => {
    expect(splitTitle("Wimbledon Mertens vs Siegemund")).toEqual({ tournament: "Wimbledon", names: ["Mertens", "Siegemund"] })
    expect(splitTitle("Open delle Puglie Trofeo DellEdera vs Prisacariu")?.tournament).toBe("Open delle Puglie Trofeo")
    expect(splitTitle("ABN AMRO World Tennis Tournament Auger Aliassime vs Griekspoor")).toEqual({ tournament: "ABN AMRO World Tennis Tournament", names: ["Auger Aliassime", "Griekspoor"] })
    expect(splitTitle("Lexus Ilkley Open Dada Mascoll vs Reed")).toEqual({ tournament: "Lexus Ilkley Open", names: ["Dada Mascoll", "Reed"] })
    expect(splitTitle("Womens Singles Rook vs Vale")).toEqual({ tournament: "Womens Singles", names: ["Rook", "Vale"] })
    expect(splitTitle("Ari Stone vs Ben Ash")).toEqual({ tournament: null, names: ["Ari Stone", "Ben Ash"] })
    expect(splitTitle("Copa Davis 2023")).toBeNull()
  })
  it("gives a bare match its players and tournament, with no result and no invented status", () => {
    const event = tennis({ strEvent: "Wimbledon Rook vs Vale" })
    expect(event).toMatchObject({ eventName: "Wimbledon", status: "unknown", score: { kind: "none" }, details: { tournament: "Wimbledon", gender: "men", format: "singles" } })
    expect(event.participants.map((item) => item.name)).toEqual(["Rook", "Vale"])
  })
  it("reads the draw line", () => {
    expect(parseTennisDraw("Harbor Open - Basel - Quarterfinals\r\nRook (31) vs Vale (1202)")).toEqual({ tournament: "Harbor Open", city: "Basel", round: "Quarterfinals", names: ["Rook", "Vale"], ranks: [31, 1202] })
  })
  it.each([["The Final", { key: "final" }], ["Semifinals", { key: "semi-final" }], ["Quarterfinals", { key: "quarter-final" }], ["2nd Round", { key: "round", number: 2 }], ["1st Round", { key: "round", number: 1 }]])("reads round %s", (text, round) => expect(tennisRound(text)).toEqual(round))
  it("reads a walkover", () => {
    expect(parseTennisResult("Rook  w/o Vale")).toMatchObject({ winner: "Rook", walkover: true, retired: null })
    const event = tennis({ strResult: "Rook  w/o Vale" })
    expect(event.status).toBe("finished")
    expect(resultLine(event, t)).toContain("Rook won by walkover")
    expect(rowValues(event)).toEqual([undefined, undefined])
  })
  it("reads a retirement with one partial set", () => {
    expect(parseTennisResult("Rook  retired from the match.\r\nVale : 5    \r\nRook : 2")).toMatchObject({ retired: "Rook", winner: null, lines: [{ name: "Vale", games: [5] }, { name: "Rook", games: [2] }] })
  })
  it("reads sets with tie-breaks, a match tie-break and either separator", () => {
    expect(parseSetRun("6-3, 4-6, 13-11")).toMatchObject({ winner: [6, 4, 13], loser: [3, 6, 11] })
    expect(parseSetRun("6-7(4), 6-4, 10-8")).toMatchObject({ winner: [6, 6, 10], loser: [7, 4, 8], tiebreaks: [4, null, null] })
    expect(parseSetRun("7-6(1) 7-6(2)")).toMatchObject({ tiebreaks: [1, 2] })
  })
  it("reads a Laver Cup line and sentence", () => {
    const line = tennis({ strLeague: "Laver Cup", strEvent: "Ari Stone vs Ben Ash", strStatus: "FT", strResult: "LAVER CUP 2026 - ARI STONE VS BEN ASH\r\nBen Ash (Team World) def. Ari Stone (Team Europe) 2-6, 7-6(5), 11-9\r\nSource: example.com" })
    expect(line.score).toMatchObject({ kind: "sets", winner: "Ben Ash", tiebreaks: [null, 5, null] })
    const doubles = tennis({ strLeague: "Laver Cup", strEvent: "Stone / Ash vs Reed / Moss", strStatus: "FT", strResult: "Ari Stone and Ben Ash closed the day in fine form, defeating Cal Reed and Dan Moss 6-4, 6-4 to give Team Europe a lead." })
    expect(doubles).toMatchObject({ participantType: "pair", score: { kind: "sets", winner: "Stone / Ash" } })
    const victory = tennis({ strLeague: "Laver Cup", strEvent: "Ari Stone vs Ben Ash", strStatus: "FT", strResult: "Ben Ash marked his debut with a 6-1, 3-6, 10-7 victory over Ari Stone, earning a point." })
    expect(victory.score).toMatchObject({ winner: "Ben Ash" })
  })
  it("treats a United Cup tie as two nations with their rubbers", () => {
    const event = tennis({ strLeague: "United Cup", idLeague: "5872", strEvent: "Atlantis vs Harbor", strStatus: "FT", strGroup: "F", strResult: "Harbor def Atlantis 2-1\r\n\r\nRook (ATL) def Vale (HAR) 6-2 6-2\r\nAsh (HAR) def Reed (ATL) 7-5 7-6(4)\r\nMoss/Lee (HAR) def Rook/Reed (ATL) 6-3 6-3" })
    expect(event).toMatchObject({ participantType: "entrant", score: { kind: "team", home: 1, away: 2 }, details: { format: "team-tie", group: "F" } })
    expect((event.details as { rubbers: unknown[] }).rubbers).toHaveLength(3)
    expect(sportSteps(event, t)[1]).toBe("Ash beat Reed: 7-5 7-6(4)")
  })
  it("keeps the rubbers of a tie whose header gives no score", () => {
    const event = tennis({ strLeague: "United Cup", strEvent: "Atlantis vs Harbor", strStatus: "FT", strResult: "Atlantis vs Harbor\r\n\r\nRook (ATL) def Vale (HAR) 6-7(4) 7-6(5) 7-5" })
    expect(event).toMatchObject({ status: "finished", score: { kind: "none" } })
    expect((event.details as { rubbers: { tiebreaks: unknown[] }[] }).rubbers[0].tiebreaks).toEqual([4, 5, null])
  })
  it("takes the winner and player records from the results endpoint when there is no text", () => {
    const event = tennis({ resultRows: [{ idPlayer: "5", strPlayer: "Tom Vale", intPosition: "1", strDetail: "WIN" }, { idPlayer: "6", strPlayer: "Sam Rook", intPosition: "1", strDetail: "LOSS" }] })
    expect(event).toMatchObject({ status: "finished", score: { kind: "sets", winner: "Vale" }, participants: [{ name: "Rook", id: "6" }, { name: "Vale", id: "5" }] })
    expect(rowValues(event)).toEqual([undefined, undefined])
    expect(resultLine(event, t)).toContain("Vale won")
  })
  it("resolves a doubles winner from both partners", () => {
    const event = tennis({ strEvent: "Mixed Doubles Rook / Vale vs Ash / Reed", strLeague: "Olympics Tennis", resultRows: [{ strPlayer: "Sam Rook", strDetail: "LOSS" }, { strPlayer: "Tom Vale", strDetail: "LOSS" }, { strPlayer: "Ben Ash", strDetail: "WIN" }, { strPlayer: "Cal Reed", strDetail: "WIN" }] })
    expect(event).toMatchObject({ participantType: "pair", score: { winner: "Ash / Reed" } })
  })
  it("tells the tours apart", () => {
    expect(tennis({ strLeague: "WTA Tour" }).details).toMatchObject({ gender: "women" })
    expect(tennis({ strLeague: "Olympics Tennis", strEvent: "Womens Singles Rook vs Vale" }).details).toMatchObject({ gender: "women", tournament: "Womens Singles" })
  })
})

const raceRow = (extra: Partial<RawEvent>): RawEvent => ({ idEvent: "3", strSport: "Motorsport", strLeague: "Harbor Series", strEvent: "Harbor Grand Prix", strTimestamp: "2026-10-01T14:00:00", strTime: "14:00:00", strTimeLocal: "10:00:00", dateEvent: "2026-10-01", strStatus: "FT", ...extra })
const places = (text: string, heat: number | null = null) => parseRace(text, heat)?.entries.map((entry) => [entry.position, entry.name, entry.team, entry.time])

describe("motorsport layouts", () => {
  it("grand prix table, with grid, pit lane, points and retirements", () => {
    const race = parseRace("1\t3\tNetherlands Ari Stone\tAlpha-Red Ford\t71\t2:20:28.772\t5\t25\r\n2\t44\tUnited Kingdom Ben Ash\tBeta\t71\t+0.799\tPL\t18\r\n3\t12\tItaly Cal Reed\tGamma\t71\t+4.006\t4\t15\r\nRet\t41\tCanada Dan Moss\tDelta\t42\tCollision\t8\t0")
    expect(race?.entries[0]).toMatchObject({ number: 3, laps: 71, grid: 5, points: 25 })
    expect(race?.entries[1]).toMatchObject({ pitLane: true, grid: null })
    expect(race?.out).toEqual([{ name: "Dan Moss", team: "Delta", status: "RET", note: "Collision", laps: 42 }])
  })
  it("slash table, with the not-classified block and championship", () => {
    const race = parseRace("1\t/Ari Stone\t\t/Alpha Racing\t\t\t/40:14.236\t\r\n2\t/Ben Ash\t\t/Beta Team\t\t/+4.172\t\r\n3\t/Cal Reed\t\t/Gamma Team\t/+5.955\t\r\n\r\nNot Classified\r\n4\t/Dan Moss\t\t/Delta Team\t\t\t/17 Laps\t\r\n\r\n------\r\n\r\nCurrent Championship Standings after Harbor\r\nPos /Driver /Team /Points\r\n\r\n1 /Ari Stone /Alpha Racing /399\r\n2 /Ben Ash /Beta Team /342")
    expect(race?.entries.map((entry) => entry.time)).toEqual(["40:14.236", "+4.172", "+5.955"])
    expect(race?.out).toEqual([{ name: "Dan Moss", team: "Delta Team", status: null, note: "17 Laps" }])
    expect(race?.standings).toEqual([{ position: 1, name: "Ari Stone", team: "Alpha Racing", points: 399 }, { position: 2, name: "Ben Ash", team: "Beta Team", points: 342 }])
  })
  it("slash table with a stray unmarked time and a colon before the milliseconds", () => {
    expect(places("1\t/Ari Stone\t\t/Alpha\t\t/42:19:363\r\n2\t/Ben Ash\t\t/Beta\t\t/+ 0:05:777\r\n3\t/Cal Reed\t\t/Gamma\t\t32:33.497")).toEqual([[1, "Ari Stone", "Alpha", "42:19.363"], [2, "Ben Ash", "Beta", "+0:05.777"], [3, "Cal Reed", "Gamma", "32:33.497"]])
  })
  it("reads pole and fastest lap from the block under a race", () => {
    expect(parseRace("1\t/Ari Stone\t/A\t/1:00.000\r\n2\t/Ben Ash\t/B\t/+1.0\r\n3\t/Cal Reed\t/C\t/+2.0\r\n-------\r\nPole Position - Ben Ash\r\nFastest Lap - Cal Reed (1:08:305)")).toMatchObject({ pole: "Ben Ash", fastestLap: { name: "Cal Reed", time: "1:08.305" } })
  })
  it("marks did not finish rows", () => {
    expect(parseRace("1\t/Ari Stone\t/A\t/1:00.000\r\n2\t/Ben Ash\t/B\t/+1.0\r\n3\t/Cal Reed\t/C\t/+2.0\r\nDNF\t/Dan Moss\t\t/D\t\t/DNF")?.out).toEqual([{ name: "Dan Moss", team: "D", status: "DNF", note: "DNF" }])
  })
  it("positions written 01, 02 and a winner marked WIN", () => {
    expect(places("01\t/Ari Stone\t\t/Alpha\t/WIN\r\n02\t/Ben Ash\t\t/Beta\t\t/+3.058 \t\r\n03\t/Cal Reed\t/Gamma\t\t/+3.698 \t")?.map((row) => row[0])).toEqual([1, 2, 3])
  })
  it("plain tabs with seconds marked", () => {
    expect(places("1\t Ari Stone\t\tAlpha\t\t1:11:45.095\t\t\r\n2\t Ben Ash\t\tBeta\t\t+4.395s\t\r\n3\t Cal Reed\t\t\tGamma\t\t\t\t+6.614s\t")?.[1]).toEqual([2, "Ben Ash", "Beta", "+4.395"])
  })
  it("name only, as old series list it", () => {
    expect(places("1   Ari Stone\r\n2   Ben Ash\r\n3   Cal Reed")?.[2]).toEqual([3, "Cal Reed", null, null])
  })
  it("numbered list with a header and notes", () => {
    expect(places("2026 Harbor Grand Prix - Qualifying (Harbor Ring, Atlantis)\r\n1. Ari Stone (Alpha) 1:34.035\r\n2. Ben Ash (Beta) +0.042\r\n3. Cal Reed (Gamma)\r\n(Pole: Stone. Source: example.com)")).toEqual([[1, "Ari Stone", "Alpha", "1:34.035"], [2, "Ben Ash", "Beta", "+0.042"], [3, "Cal Reed", "Gamma", null]])
  })
  it("a numbered top ten that resumes further down keeps the unbroken part", () => {
    const race = parseRace("Top 10:\r\n1. Ari Stone (#19, Alpha Racing) - 267 laps\r\n2. Ben Ash (#20, Alpha Racing) - 267 laps\r\n3. Cal Reed (#12, Gamma) - 267 laps\r\n\r\nPositions 11-35: not entered\r\n\r\n36. Dan Moss (#7, Delta) - 100 laps")
    expect(race?.entries).toHaveLength(3)
    expect(race?.entries[0]).toMatchObject({ number: 19, team: "Alpha Racing", laps: 267 })
  })
  it("pipe table, where a car's team is the entrant", () => {
    const race = parseRace("6 Hours of Harbor - Hyperpole (Hypercar) - Full Classification\r\nPos | Car # | Team | Best Lap | Gap\r\n1 | #17 | Alpha Racing | 1:30.166 | -\r\n2 | #8 | Beta Team | 1:30.336 | +0.170\r\n3 | #009 | Gamma | 1:30.490 | +0.324")
    expect(race?.entries.map((entry) => [entry.name, entry.number, entry.time])).toEqual([["Alpha Racing", 17, "1:30.166"], ["Beta Team", 8, "+0.170"], ["Gamma", 9, "+0.324"]])
  })
  it("car and class table, keeping each class", () => {
    const race = parseRace("GT3\r\nPos /Car # /Team /Drivers /Time\r\n\r\n1 \t18 \t Alpha Motorsport \tAri STONE, Ben ASH \t\t1:01:22.885 \t\r\n2 \t78 \t Beta \tCal REED, Dan MOSS \t\t1:01:36.847 \t\r\n3 \t1 \t Gamma \tEli VALE, Finn ROOK \t\t\t1:01:46.079 \t\r\nGT4\r\n1 /42 / Delta Racing /Gus LEE, Hal KIM /1:02:00.000\r\n2 /43 / Echo /Ivo POE, Jan NOR /1:02:10.000\r\n3 /44 / Foxtrot /Kai BOW, Leo FOX /1:02:20.000")
    expect(race).toMatchObject({ className: "GT3", entries: [{ name: "Ari STONE, Ben ASH", team: "Alpha Motorsport", number: 18 }, {}, {}], classes: [{ name: "GT4", entries: [{ number: 42 }, {}, {}] }] })
  })
  it("Super GT rows, with laps and an apostrophe in the time", () => {
    const race = parseRace("SUPER GT 2026 Round 4 - Harbor Speedway\r\nSource: example.com\r\n\r\nGT500 Classification:\r\n1 #100 Ari Stone/Ben Ash - ALPHA TEAM (Honda) - 66 laps, 1'29.842\r\n2 #8 Cal Reed/Dan Moss - BETA (Honda) - 66, +0.662\r\n3 #37 Eli Vale/Finn Rook - GAMMA (Toyota) - 66, +1.478")
    expect(race).toMatchObject({ className: "GT500", entries: [{ number: 100, laps: 66, time: "1:29.842" }, { time: "+0.662" }, {}] })
  })
  it("a weekend record holding two races gives each session its own", () => {
    const text = "Harbor Sprint Cup\r\n\r\nRACE 1 (33 laps)\r\n1. #3 Ari Stone/Ben Ash (Alpha) Pro Cup\r\n2. #50 Cal Reed/Dan Moss (Beta) Pro Cup +2.597\r\n3. #7 Eli Vale/Finn Rook (Gamma) Gold Cup +3.395\r\nRACE 2 (33 laps)\r\n1. #50 Cal Reed/Dan Moss (Beta) Pro Cup\r\n2. #3 Ari Stone/Ben Ash (Alpha) Pro Cup +1.000\r\n3. #7 Eli Vale/Finn Rook (Gamma) Gold Cup +2.000"
    expect(places(text, 2)?.[0]).toEqual([1, "Cal Reed/Dan Moss", "Beta", null])
    expect(places(text, 1)?.[0]).toEqual([1, "Ari Stone/Ben Ash", "Alpha", null])
  })
  it.each(["The race was held on 11 October 2026, and was run for 62 laps.", "Ari Stone set the pace in the opening session.", "Championship Standings:\r\n1. Alpha: 87 points", "Group A: 1 A. Stone 1:15.157, 2 B. Ash +0.105"])("hides prose: %s", (text) => expect(parseRace(text)).toBeNull())
})

describe("motorsport results endpoint", () => {
  const rows = [
    { idPlayer: "1", strPlayer: "Ari Stone", intPosition: "1", strDetail: "2:20:28.772" }, { idPlayer: "2", strPlayer: "Ben Ash", intPosition: "2", strDetail: "+0.799s" },
    { idPlayer: "3", strPlayer: "Cal Reed", intPosition: "3", strDetail: "2 Laps" }, { idPlayer: "4", strPlayer: "Dan Moss", intPosition: "22", strDetail: "DNF" },
  ]
  it("reads places, times, lapped cars and retirements", () => {
    expect(raceFromRows(rows)).toEqual({
      entries: [{ position: 1, name: "Ari Stone", team: null, time: "2:20:28.772", playerId: "1" }, { position: 2, name: "Ben Ash", team: null, time: "+0.799", playerId: "2" }, { position: 3, name: "Cal Reed", team: null, time: "2 Laps", playerId: "3" }],
      out: [{ name: "Dan Moss", team: null, status: "DNF", note: null }],
    })
  })
  it("reads a rally's total times, leaving a broken order out of the places", () => {
    expect(raceFromRows([{ strPlayer: "A", intPosition: "1", strDetail: "03:24:57.0" }, { strPlayer: "B", intPosition: "2", strDetail: "03:25:54.6" }, { strPlayer: "C", intPosition: "3", strDetail: "03:26:34.4" }, { strPlayer: "D", intPosition: "22", strDetail: "04:12:25.5" }])).toMatchObject({ entries: [{}, {}, {}], out: [{ name: "D", status: null, note: "04:12:25.5" }] })
  })
  it("adds player records to a pasted table without losing its teams", () => {
    const event = normalizeEvent(raceRow({ strResult: "1\t/Ari Stone\t/Alpha\t/1:00.000\r\n2\t/Ben Ash\t/Beta\t/+1.0\r\n3\t/Cal Reed\t/Gamma\t/+2.0", resultRows: rows }), "motorsport", NOW)
    expect(event.score).toMatchObject({ entries: [{ name: "Ari Stone", team: "Alpha", playerId: "1" }, {}, {}] })
    expect(event.participants[0]).toMatchObject({ name: "Ari Stone", id: "1" })
  })
  it("ignores an empty answer", () => {
    expect(raceFromRows([])).toBeNull()
    expect(raceFromRows(null)).toBeNull()
  })
})

describe("motorsport sessions", () => {
  it.each([
    ["Harbor Grand Prix Practice 3", "practice", 3, "Harbor Grand Prix"], ["Tokyo ePrix Free Practice 2", "practice", 2, "Tokyo ePrix"], ["Harbor Grand Prix Qualifying", "qualifying", null, "Harbor Grand Prix"],
    ["Harbor Sprint Qualifying", "sprint-qualifying", null, "Harbor"], ["Malaysia Sprint Race", "sprint", null, "Malaysia"], ["Harbor Grand Prix", "race", null, "Harbor Grand Prix"], ["Brands Hatch GP Race 3", "race", 3, "Brands Hatch GP"],
    ["Bahrain Testing 1 Day 2", "testing", 2, "Bahrain"], ["Harbor Superpole", "qualifying", null, "Harbor"],
  ])("reads %s", (title, session, number, weekend) => expect(sessionOf(title)).toMatchObject({ session, number, weekend }))
  it("keeps the class out of the weekend name", () => expect(sessionOf("6 Hours of Harbor Hyperpole - LMGT3")).toMatchObject({ session: "qualifying", className: "LMGT3", weekend: "6 Hours of Harbor" }))
  it("reads the round, circuit and planned distance", () => {
    expect(normalizeEvent(raceRow({ intRound: "19", strVenue: "Harbor Ring", strCity: "Harbor", strCountry: "Atlantis", strSeason: "2026", strResult: "The race was held on 11 October 2026, and was run for 62 laps." }), "motorsport", NOW).details).toMatchObject({ round: 19, circuit: "Harbor Ring", scheduledLaps: 62, session: "race" })
  })
})

const fightRow = (extra: Partial<RawEvent>): RawEvent => ({ idEvent: "4", strSport: "Fighting", strLeague: "UFC", strEvent: "UFC 333 Rook vs Vale", strTimestamp: "2026-10-24T20:00:00", strTime: "20:00:00", dateEvent: "2026-10-24", strStatus: "FT", ...extra })
const fight = (extra: Partial<RawEvent>) => normalizeEvent(fightRow(extra), "combat-sports", NOW)
const CARD = "Main card (Stream+)\r\nWeight class \t\t\t\tMethod \tRound \tTime \tNotes\r\nFeatherweight \tTom Vale (c) \tdef. \tSam Rook \tTKO (punches) \t2 \t4:54 \t\r\nBantamweight \tAri Stone \tdef. \tBen Ash \tDecision (unanimous) (48–47, 48–47, 48–47) \t5 \t5:00 \t\r\nPreliminary card (Stream+)\r\nCatchweight (148 lb) \tCal Reed \tdef. \tDan Moss \tDecision (split) (28–29, 29–28, 29–28) \t3 \t5:00 \t"

describe("combat cards", () => {
  it("reads every bout with class, section, method, round, time and scorecards", () => {
    const event = fight({ strResult: CARD })
    const { bouts } = event.details as { bouts: { names: string[]; winner: string; section: string; weightClass: string; method: string; round: number; time: string; scorecards: string }[] }
    expect(bouts).toHaveLength(3)
    expect(bouts[0]).toMatchObject({ winner: "Tom Vale", method: "tko", round: 2, time: "4:54", section: "main", weightClass: "Featherweight" })
    expect(bouts[1]).toMatchObject({ method: "unanimous-decision", scorecards: "48-47, 48-47, 48-47" })
    expect(bouts[2]).toMatchObject({ section: "preliminary", weightClass: "Catchweight (148 lb)", method: "split-decision" })
    expect(event.score).toMatchObject({ kind: "combat", winner: "Vale", method: "tko", round: 2 })
  })
  it("never lists the winner first in a bout's names", () => {
    const { bouts } = fight({ strResult: CARD }).details as { bouts: { names: string[] }[] }
    expect(bouts[0].names).toEqual(["Sam Rook", "Tom Vale"])
  })
  it("discards the table when the sentence above it says the opposite", () => {
    const event = fight({ strResult: `Sam Rook dethroned Tom Vale by unanimous decision to become champion.\r\n\r\n${CARD}` })
    expect(event.score).toEqual({ kind: "none" })
    expect((event.details as { bouts: { winner: string | null }[] }).bouts.every((bout) => bout.winner === null)).toBe(true)
  })
  it("strips the country ONE puts in the name cell", () => {
    const event = fight({ strLeague: "ONE", strEvent: "ONE Friday Fights 177 Rook vs Vale", strResult: "ONE Friday Fights 177 (Stream)\r\nWeight Class \t\t\t\tMethod \tRound \tTime \tNotes\r\nBantamweight Muay Thai \tThailand Tom Vale P.K \tdef. \tThailand Sam Rook \tDecision (unanimous) \t3 \t3:00 \t\r\nAtomweight Kickboxing \tLaos Ari Stone \tdef. \tJapan Ben Ash \tKO (punch to the body) \t2 \t0:57 \t" })
    expect((event.details as { bouts: { names: string[] }[] }).bouts[1].names).toEqual(["Ari Stone", "Ben Ash"])
  })
  it("lists a card announced but not fought, with no winners", () => {
    const event = fight({ strStatus: "", strEvent: "UFC Fight Night 288 Rook vs Vale", strResult: "Fight card (Stream+)\r\nWeight class \t\t\t\tMethod \tRound \tTime \tNotes\r\nFeatherweight \tSam Rook \tvs. \tTom Vale \t\t\t\t\r\nFlyweight \tAri Stone (c) \tvs. \tBen Ash \t\t\t\t", strTimestamp: "2026-12-01T20:00:00", dateEvent: "2026-12-01" })
    expect(event).toMatchObject({ status: "scheduled", score: { kind: "none" } })
    expect((event.details as { bouts: { names: string[]; winner: null }[] }).bouts).toEqual([expect.objectContaining({ names: ["Sam Rook", "Tom Vale"], winner: null, weightClass: "Featherweight" }), expect.objectContaining({ names: ["Ari Stone", "Ben Ash"] })])
  })
  it.each([
    ["Main Event: Tom Vale def. Sam Rook - TKO (punches), Round 2, 0:13", "Tom Vale", "tko", 2, "0:13", null],
    ["Tom Vale def. Sam Rook - TKO (slam), R5 1:38 (Main Event)", "Tom Vale", "tko", 5, "1:38", null],
    ["Lightweight: Tom Vale def. Sam Rook - R1 TKO (slam), 1:01 - UFC contract awarded", "Tom Vale", "tko", 1, "1:01", "Lightweight"],
    ["Tom Vale def. Sam Rook - Unanimous Decision (49-46 x3), 5 rounds (Main Event)", "Tom Vale", "unanimous-decision", null, null, null],
    ["Main event: Tom Vale def. Sam Rook by KO (standing punches), Round 3 at 0:40 (bantamweight title bout).", "Tom Vale", "ko", 3, "0:40", null],
    ["Main event: Tom Vale def. Sam Rook by unanimous decision (49-46, 49-46, 48-47), bantamweight title.", "Tom Vale", "unanimous-decision", null, null, null],
  ])("reads a results list row: %s", (row, winner, method, round, time, weightClass) => {
    const event = fight({ strEvent: "Harbor 211 Harbor City", strResult: `Harbor 211: Harbor City - Full Card Results\r\n${row}\r\nAri Stone def. Ben Ash - Submission (D'Arce choke), R1 1:02` })
    expect((event.details as { bouts: { winner: string }[] }).bouts[0]).toMatchObject({ winner, method, round, time, weightClass })
    expect(event.status).toBe("finished")
  })
  it("reads a card with a table but no headliners in its title", () => {
    const event = fight({ strLeague: "ONE", strEvent: "ONE Fight Night 49", strResult: CARD })
    expect(event).toMatchObject({ status: "finished", participants: [], eventName: "ONE Fight Night 49" })
    expect((event.details as { bouts: unknown[] }).bouts).toHaveLength(3)
  })
})

describe("single bouts", () => {
  const boxing = (result: string, title = "Tom Vale vs Sam Rook") => normalizeEvent(fightRow({ strLeague: "Boxing", strEvent: title, strResult: result }), "combat-sports", NOW)
  it.each([
    ["Sam Rook def. Tom Vale by unanimous decision (118-108, 118-108, 115-111), Harbor, October 24, 2026.", "Sam Rook", "unanimous-decision", null],
    ["Sam Rook (WBC champion) def. Tom Vale by split decision (12 rounds), Harbor Arena, October 24, 2026.", "Sam Rook", "split-decision", null],
    ["Tom Vale defeated Sam Rook by unanimous decision in Harbor to regain the WBC title.", "Tom Vale", "unanimous-decision", null],
    ["Sam Rook stopped Tom Vale in the opening round of their heavyweight clash.", "Sam Rook", "tko", 1],
    ["Tom Vale retained the WBC title with a dramatic stoppage of Sam Rook at 2:59 of the 12th round.", "Tom Vale", "tko", 12],
    ["Sam Rook produced a dominant performance to stop Tom Vale in the second round and retain the title.", "Sam Rook", "tko", 2],
    ["Sam Rook survived the toughest test of his career to defeat Tom Vale by unanimous decision in Harbor.", "Sam Rook", "unanimous-decision", null],
    ["Sam Rook retained the WBC title with a unanimous-decision victory over Tom Vale in their rematch.", "Sam Rook", "unanimous-decision", null],
    ["Sam Rook won his professional debut by split decision over Tom Vale in the main event.", "Sam Rook", "split-decision", null],
    ["Sam Rook retained his interim title with a sixth-round knockout of Tom Vale at Harbor Arena.", "Sam Rook", "ko", 6],
  ])("reads %s", (text, winner, method, round) => expect(boxing(text).score).toMatchObject({ kind: "combat", winner, method, round }))
  it("reads the time of a stoppage", () => expect(boxing("Tom Vale retained the WBC title with a stoppage of Sam Rook at 2:59 of the 12th round.").score).toMatchObject({ time: "2:59" }))
  it("handles a rematch title", () => {
    expect(parseCard("Tom Vale vs Sam Rook 2", true)?.names).toEqual(["Tom Vale", "Sam Rook"])
    expect(parseCard("Tom Vale vs Sam Rook II", true)?.names).toEqual(["Tom Vale", "Sam Rook"])
  })
  it("reads a numbered promotion title", () => {
    expect(parseCard("MVPW 07 Rook vs Vale", true)).toEqual({ card: "MVPW 07", names: ["Rook", "Vale"] })
  })
  it("takes a place out of a headliner's name when the preview says so", () => {
    const event = fight({ strLeague: "BKFC", strEvent: "BKFC 96 Harbor Rook vs Vale", strStatus: "", strDescriptionEN: "Sean Rook faces Leigh Vale in Harbor.", strTimestamp: "2026-12-01T20:00:00", dateEvent: "2026-12-01" })
    expect(event.participants.map((item) => item.name)).toEqual(["Rook", "Vale"])
  })
  it("gives up on a sentence that names neither outcome", () => {
    expect(parseCombatResult("A thrilling night in Harbor for all involved.", ["Tom Vale", "Sam Rook"])).toBeNull()
  })
  it("reads weight, rounds and title from the preview text", () => {
    const event = normalizeEvent(fightRow({ strLeague: "Boxing", strEvent: "Tom Vale vs Sam Rook", strStatus: "", strResult: null, strTimestamp: "2026-12-01T20:00:00", dateEvent: "2026-12-01", strDescriptionEN: "Tom Vale defends the WBC super middleweight title against Sam Rook in a twelve-round fight.", strCity: "Harbor", intSpectators: "14065" }), "combat-sports", NOW)
    expect(event.details).toMatchObject({ discipline: "boxing", weightClass: "Super Middleweight", scheduledRounds: 12, title: "WBC super middleweight title", city: "Harbor", spectators: 14065 })
    expect(event.status).toBe("scheduled")
  })
})

describe("combat results endpoint", () => {
  const rows = [
    { strPlayer: "Tom Vale", intPosition: "1", strDetail: "WIN" }, { strPlayer: "Sam Rook", intPosition: "1", strDetail: "LOSS" },
    { strPlayer: "Ari Stone", intPosition: "2", strDetail: "WIN" }, { strPlayer: "Ben Ash", intPosition: "2", strDetail: "LOSS" },
    { strPlayer: "Cal Reed", intPosition: "4", strDetail: "LOSS" },
  ]
  it("pairs a bout's two lines and leaves a lone line out", () => {
    expect(boutsFromRows(rows).map((bout) => [bout.winner, bout.loser])).toEqual([["Tom Vale", "Sam Rook"], ["Ari Stone", "Ben Ash"]])
  })
  it("distrusts a fighter listed in two bouts on one card", () => {
    expect(boutsFromRows([...rows, { strPlayer: "Sam Rook", intPosition: "3", strDetail: "WIN" }, { strPlayer: "Tom Vale", intPosition: "3", strDetail: "LOSS" }]).map((bout) => bout.winner)).toEqual(["Ari Stone"])
  })
  it("fills an event with no text, and never overrules text that exists", () => {
    expect(fight({ resultRows: rows })).toMatchObject({ status: "finished", score: { kind: "combat", winner: "Vale", method: null } })
    expect(fight({ resultRows: rows, strResult: "Sam Rook dethroned Tom Vale by unanimous decision." }).score).toMatchObject({ winner: "Rook" })
  })
})

describe("what counts as combat", () => {
  const covered = (strLeague: string) => isCovered({ idEvent: "1", strLeague }, "combat-sports")
  it.each(["UFC", "Boxing", "ONE", "BKFC", "Oktagon MMA", "Bellator", "Rizin FF", "Cage Warriors", "Glory", "Invicta FC", "ACA", "KSW", "Top Rank", "Pancrase", "Shooto", "RISE", "K-1"])("keeps %s", (league) => expect(covered(league)).toBe(true))
  it.each(["WWE", "AEW", "NJPW", "TNA Wrestling", "ROH", "WCW", "ECW", "NWA", "CMLL", "AAA", "RevPro", "wXw", "Stardom", "DDT Pro", "Professional Wrestling", "Sumo", "One Pro Wrestling"])("leaves out %s", (league) => expect(covered(league)).toBe(false))
})

describe("page sections", () => {
  const county = cricket({ strLeague: "English County Championship Division 1", strEvent: "Hampshire vs Sussex", strHomeTeam: "Hampshire", strAwayTeam: "Sussex", strStatus: "", intHomeScore: "366", intAwayScore: "563", strDescriptionEN: "Sussex won by 197 runs\r\nSUS 244 & 319/9d\r\nHAM 128 & 238" })
  const sections = [
    ["cricket", county],
    ["tennis", tennis({ strDescriptionEN: "Harbor Open - Basel - The Final\r\nRook (21) vs Vale (31)", strResult: "Vale  beat Rook  2-1\r\nVale : 2 6 6  \r\nRook : 6 3 3" })],
    ["motorsport", normalizeEvent(raceRow({ strResult: "1\t3\tSpain Ari Stone\tAlpha\t71\t2:20:28.772\t5\t25\r\n2\t44\tSpain Ben Ash\tBeta\t71\t+0.799\t1\t18\r\n3\t12\tSpain Cal Reed\tGamma\t71\t+4.006\t4\t15" }), "motorsport", NOW)],
    ["combat", fight({ strResult: CARD })],
  ] as const

  it.each(sections)("%s has facts in both languages with no result in them", (_, event) => {
    const secrets = event.details?.kind === "combat" ? ["Tom Vale won"] : ["won by", "197"]
    for (const dictionary of [t, fr]) {
      const facts = sportFacts(event, dictionary)
      expect(facts.length).toBeGreaterThan(0)
      for (const secret of secrets) expect(JSON.stringify(facts)).not.toContain(secret)
    }
  })
  it("gives a card a line that says what the event is", () => {
    expect(sportChip(county, t)).toBe("First-class")
    expect(sportChip(sections[1][1], t)).toBe("Final · Men")
    expect(sportChip(sections[2][1], t)).toBe("Race")
    expect(sportChip(sections[3][1], t)).toBe("MMA · 3 bouts")
    expect(sportChip(sections[3][1], fr)).toBe("MMA · 3 combats")
  })
  it("orders what happened", () => {
    expect(sportSteps(county, t)).toEqual(["Hampshire: 128 & 238", "Sussex: 244 & 319/9d"])
    expect(sportSteps(sections[1][1], t)[0]).toBe("Set 1: Rook 6-2 Vale")
    expect(sportSteps(sections[3][1], t)[0]).toBe("Tom Vale beat Sam Rook: technical knockout, Round 2, 4:54")
  })
  it("adds the result facts a score table has no room for", () => {
    const facts = resultFacts(cricket({ strResult: "North won by 3 wickets (with 4 balls remaining) (DLS method)\r\nPlayer of the Match: Ari Stone", intHomeScore: "100", intAwayScore: "99" }), t)
    expect(facts.map((fact) => fact.value)).toEqual(["4", "DLS method", "Ari Stone"])
  })
  it("renders each section", () => {
    for (const [, event] of sections) {
      const html = renderToStaticMarkup(createElement("div", null, createElement(SportFacts, { event, t }), createElement(SportStatistics, { event, t }), createElement(SportUpdates, { event, t })))
      expect(html).toContain(t.sportTerms.facts)
      expect(html).not.toMatch(/undefined|null|NaN/)
    }
  })
  it("masks the sections' card line and result in spoiler mode", () => {
    const html = renderToStaticMarkup(createElement(EventCard, { event: county, t, href: (path: string) => path }))
    expect(html).toContain("First-class")
    expect(html).not.toContain("244")
    expect(html).not.toContain("197")
  })
  it("translates weight classes", () => {
    expect(weightClassText("Women's Bantamweight", fr)).toBe("Poids coqs féminin")
    expect(weightClassText("Light Heavyweight", fr)).toBe("Poids mi-lourds")
    expect(weightClassText("Catchweight (148 lb)", fr)).toBe("Poids convenu (148 lb)")
    expect(weightClassText("Bantamweight Muay Thai", fr)).toBe("Poids coqs Muay-thaï")
    expect(weightClassText("Women's Bantamweight", t)).toBe("Women's Bantamweight")
  })
})
