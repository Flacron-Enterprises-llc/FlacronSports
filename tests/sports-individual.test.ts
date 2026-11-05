// Synthetic records shaped like real samples from the feed. Names are invented; the
// layout of each field, including tabs, blank columns and the winner-first order, is not.
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const prefs = vi.hoisted(() => ({ spoilerMode: false }))
// The test transform compiles JSX to React.createElement rather than the automatic runtime.
Object.assign(globalThis, { React })

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))
vi.mock("@/components/account/prefs-provider", () => ({
  usePreferences: () => ({ prefs: { spoilerMode: prefs.spoilerMode, favorites: [], timeZone: "UTC" }, signedIn: false, update: async () => true }),
}))
vi.mock("@/lib/use-locale", async () => {
  const { getDictionary } = await import("@/lib/i18n")
  return { useLocale: () => ({ locale: "en", t: getDictionary("en"), href: (path: string) => path }) }
})

import { EventCard } from "@/components/sports/event-card"
import { EventResult } from "@/components/sports/event-result"
import { buildAlert, dueAlerts, followsEvent } from "@/lib/alerts/rules"
import { supportsScorePrediction } from "@/lib/community/predictions"
import { buildReport, isGrounded, withholdReason } from "@/lib/content/reports"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_PREFERENCES } from "@/lib/me/preferences-defaults"
import { eventTitle, resultLine } from "@/lib/sports/presentation"
import { parseClassification, parseCombatResult } from "@/lib/sports/results"
import { clearFeedCache, getEvent, getEvents } from "@/lib/sports/service"
import { isCovered, normalizeEvent, type RawEvent } from "@/lib/sports/thesportsdb"
import type { SportEvent } from "@/lib/sports/types"

const NOW = new Date("2026-11-05T12:00:00Z")
const t = getDictionary("en")

const tennis: RawEvent = {
  idEvent: "10", strSport: "Tennis", strEvent: "Harbor Open Rook vs Vale", strLeague: "ATP World Tour", idLeague: "4464", strCity: "Basel",
  strTimestamp: "2026-11-01T00:00:00", strTime: "00:00:00", strStatus: "", intHomeScore: null, intAwayScore: null,
  strDescriptionEN: "Harbor Open - Basel - The Final\r\nRook (21) vs Vale (31)",
  strResult: "Vale  beat Rook  2-1\r\nVale : 2 6 6  \r\nRook : 6 3 3",
}
const retired: RawEvent = { ...tennis, idEvent: "11", strResult: "Rook  retired from the match.\r\nVale : 6 2   \r\nRook : 2 0" }

const f1Row = (position: number | string, number: number, name: string, team: string, time: string) => `${position}\t${number}\t${name}\t${team}\t71\t${time}\t5\t25`
const race: RawEvent = {
  idEvent: "20", strSport: "Motorsport", strEvent: "Harbor Grand Prix", strLeague: "Formula 1", idLeague: "4370", strCity: "Harbor",
  strTimestamp: "2026-11-01T20:00:00", strTime: "20:00:00", strTimeLocal: "14:00:00", strStatus: "",
  strResult: [
    f1Row(1, 3, "Netherlands Ari Stone", "Alpha Racing", "2:20:28.772"),
    f1Row(2, 44, "United Kingdom Ben Ash", "Beta Team", "+0.799"),
    f1Row(3, 12, "New Zealand Cal Reed", "Gamma Team", "+4.006a"),
    f1Row("Ret", 41, "Canada Dan Moss", "Delta Team", "Collision"),
  ].join("\r\n"),
}
const riders: RawEvent = {
  ...race, idEvent: "21", strLeague: "MotoGP", strResult:
    "1\t/Ari Stone\t\t/Alpha Racing\t\t\t/40:14.236\t\r\n2\t/Ben Ash\t\t/Beta Team\t\t/+4.172\t\r\n3\t/Cal Reed\t\t/Gamma Team\t/+5.955\t\r\n\r\nNot Classified\r\n4\t/Dan Moss\t\t/Delta Team\t\t\t/17 Laps\t\r\n\r\n------\r\n\r\nCurrent Championship Standings\r\nPos /Driver /Team /Points\r\n\r\n1 /Ari Stone /Alpha Racing /399",
}
const session: RawEvent = { idEvent: "22", strSport: "Motorsport", strEvent: "Harbor Grand Prix Practice 3", strLeague: "Formula 1", strTimestamp: "2026-11-07T14:30:00", strTime: "14:30:00", strTimeLocal: "11:30:00" }

const boxing: RawEvent = {
  idEvent: "30", strSport: "Fighting", strEvent: "Ivan Kovac vs Teo Álvarez", strLeague: "Boxing", idLeague: "4445", strTimestamp: "2026-10-31T14:00:00", strTime: "14:00:00", strStatus: "FT",
  strResult: "Teo Alvarez (WBC champion) def. Ivan Kovac by split decision (12 rounds), Harbor Arena, October 31, 2026. Source: example.com",
}
const cardTable = "Fight card (Stream+)\r\nWeight class \t\t\t\tMethod \tRound \tTime \tNotes\r\nLightweight \tTom Rook \tdef. \tSam Vale \tTKO (punches and elbows) \t3 \t1:28 \t\r\nWelterweight \tLuana Santos \tdef. \tYana Santos \tDecision (unanimous) (30–26, 30–26, 30–26) \t3 \t5:00 \t"
const card: RawEvent = { idEvent: "31", strSport: "Fighting", strEvent: "UFC Fight Night 292 Vale vs Rook", strLeague: "UFC", strTimestamp: "2026-10-31T21:00:00", strTime: "21:00:00", strResult: cardTable }
const unnamedCard: RawEvent = { idEvent: "32", strSport: "Fighting", strEvent: "ONE Fight Night 49", strLeague: "ONE", strTimestamp: "2026-11-07T02:00:00", strTime: "02:00:00" }
const wrestling: RawEvent = { idEvent: "33", strSport: "Fighting", strEvent: "Dynamite #370", strLeague: "AEW", strResult: "Singles Match\r\nA vs. B", strTimestamp: "2026-11-05T00:30:00", strTime: "00:30:00" }

const cricket: RawEvent = {
  idEvent: "40", strSport: "Cricket", strEvent: "North Cricket vs South Cricket", strLeague: "One Day International Series", idLeague: "4801",
  strHomeTeam: "North Cricket", strAwayTeam: "South Cricket", idHomeTeam: "1", idAwayTeam: "2", strTimestamp: "2026-07-21T18:30:00", strTime: "18:30:00", strStatus: "FT",
  intHomeScore: "269", intHomeScoreExtra: "8", intAwayScore: "268", intAwayScoreExtra: "9",
  strResult: "5th ODI, Harbor Oval\r\nSouth 268/9 (50 overs)\r\nNorth 269/8 (47.3 overs)\r\nNorth won by 2 wickets (with 15 balls remaining)\r\nSource: Example Cricket Site.",
}

const normalize = (raw: RawEvent, sport: SportEvent["sportId"]) => normalizeEvent(raw, sport, NOW)
const sports = { tennis: "tennis", motorsport: "motorsport", combat: "combat-sports", cricket: "cricket" } as const

describe("no fake teams", () => {
  it("gives tennis two named players in draw order, not winner first", () => {
    const event = normalize(tennis, sports.tennis)
    expect(event.participantType).toBe("individual")
    expect(event.participants.map((item) => [item.name, item.role])).toEqual([["Rook", "competitor"], ["Vale", "competitor"]])
    expect(event.eventName).toBe("Harbor Open")
    expect(event.participants.map((item) => item.name)).not.toContain("TBD")
  })
  it("shows a tennis event with no named players as the event only", () => {
    const event = normalize({ idEvent: "12", strEvent: "Harbor Open Day 2", strLeague: "ATP World Tour", strTimestamp: "2026-11-09T00:00:00" }, sports.tennis)
    expect(event.participants).toEqual([])
    expect(event.eventName).toBe("Harbor Open Day 2")
  })
  it("marks doubles as a pair", () => {
    const doubles = { ...tennis, strDescriptionEN: "Harbor Open - Basel - The Final\r\nRook/Ash vs Vale/Reed", strResult: null }
    expect(normalize(doubles, sports.tennis).participantType).toBe("pair")
  })
  it("renders a motorsport session with no participants under its own name", () => {
    const event = normalize(session, sports.motorsport)
    expect(event).toMatchObject({ participants: [], participantType: "entrant", eventType: "session", eventName: "Harbor Grand Prix Practice 3", score: { kind: "none" } })
    expect(eventTitle(event)).toBe("Harbor Grand Prix Practice 3")
  })
  it("takes boxers from the title and headliners from a numbered card", () => {
    expect(normalize(boxing, sports.combat)).toMatchObject({ eventType: "bout", eventName: null })
    expect(normalize(boxing, sports.combat).participants.map((item) => item.name)).toEqual(["Ivan Kovac", "Teo Álvarez"])
    expect(normalize(card, sports.combat)).toMatchObject({ eventType: "fight-card", eventName: "UFC Fight Night 292" })
    expect(normalize(card, sports.combat).participants.map((item) => item.name)).toEqual(["Vale", "Rook"])
  })
  it("does not split a card title that gives no safe boundary", () => {
    expect(normalize(unnamedCard, sports.combat)).toMatchObject({ participants: [], eventName: "ONE Fight Night 49" })
    expect(normalize({ ...unnamedCard, strEvent: "Fight Night Rook vs Vale" }, sports.combat).participants).toEqual([])
  })
  it("keeps cricket as its two real teams", () => {
    expect(normalize(cricket, sports.cricket)).toMatchObject({ participantType: "team", eventType: "match" })
    expect(normalize(cricket, sports.cricket).participants.map((item) => item.role)).toEqual(["home", "away"])
  })
  it("treats scripted wrestling as outside combat sports", () => {
    expect(isCovered(wrestling, "combat-sports")).toBe(false)
    expect(isCovered({ ...wrestling, strLeague: "One Pro Wrestling" }, "combat-sports")).toBe(false)
    for (const raw of [boxing, card, unnamedCard]) expect(isCovered(raw, "combat-sports")).toBe(true)
    expect(isCovered(wrestling, "tennis")).toBe(true)
  })
})

describe("scores come only from the source", () => {
  it("reads tennis sets per player", () => {
    expect(normalize(tennis, sports.tennis).score).toEqual({
      kind: "sets", winner: "Vale", retired: null,
      lines: [{ name: "Vale", games: [2, 6, 6] }, { name: "Rook", games: [6, 3, 3] }],
    })
  })
  it("reports a retirement without declaring a winner", () => {
    expect(normalize(retired, sports.tennis).score).toMatchObject({ kind: "sets", winner: null, retired: "Rook" })
  })
  it("drops a tennis result that does not fit exactly", () => {
    expect(normalize({ ...tennis, strResult: "Vale beat Rook" }, sports.tennis).score).toEqual({ kind: "none" })
    expect(normalize({ ...tennis, strResult: "Vale : 6 6\r\nRook : 3" }, sports.tennis).score).toEqual({ kind: "none" })
  })
  it("reads runs, wickets, overs and margin only as stated", () => {
    expect(normalize(cricket, sports.cricket).score).toEqual({
      kind: "innings", winner: "North Cricket", margin: { value: 2, unit: "wickets" },
      home: { runs: 269, wickets: 8, overs: "47.3" }, away: { runs: 268, wickets: 9, overs: "50" },
    })
  })
  it("leaves missing wickets missing, never zero", () => {
    const score = normalize({ ...cricket, intHomeScoreExtra: null, intAwayScoreExtra: "", strResult: "North won by 9 wickets (with 62 balls remaining)" }, sports.cricket).score
    expect(score).toMatchObject({ home: { runs: 269, wickets: null }, away: { runs: 268, wickets: null } })
  })
  it("keeps one side missing when the other never batted", () => {
    const score = normalize({ ...cricket, strStatus: "ABD", intAwayScore: null, intAwayScoreExtra: null, strResult: "Abandoned due to rain." }, sports.cricket).score
    expect(score).toMatchObject({ kind: "innings", away: null, winner: null })
  })
  it("never flattens a test match into one number", () => {
    expect(normalize({ ...cricket, strLeague: "ICC World Test Championship" }, sports.cricket).score).toEqual({ kind: "none" })
  })
  it("does not show a score for a match that has not started", () => {
    expect(normalize({ ...cricket, strStatus: "NS", strTimestamp: "2026-12-01T10:00:00", strResult: null }, sports.cricket).score).toEqual({ kind: "none" })
  })
  it("reads winner and method from a clean sentence, accents and titles aside", () => {
    expect(normalize(boxing, sports.combat).score).toEqual({ kind: "combat", winner: "Teo Álvarez", method: "split-decision", round: null, time: null })
  })
  it("reads the headline bout from a card table", () => {
    expect(normalize(card, sports.combat).score).toEqual({ kind: "combat", winner: "Rook", method: "tko", round: 3, time: "1:28" })
  })
  it("believes neither source when the prose and the table disagree", () => {
    const prose = "Sam Vale dethroned Tom Rook by unanimous decision to become champion.\r\n\r\nMain card\r\n"
    expect(parseCombatResult(prose + cardTable, ["Vale", "Rook"])).toBeNull()
    expect(normalize({ ...card, strResult: prose + cardTable }, sports.combat).score).toEqual({ kind: "none" })
  })
  it("does not confuse two fighters who share a surname", () => {
    expect(parseCombatResult("Light \tLuana Santos \tdef. \tYana Santos \tDecision (unanimous) \t3 \t5:00", ["Yana Santos", "Ana Santos"])).toBeNull()
  })
  it("reads only classified finishers from both table layouts", () => {
    expect(normalize(race, sports.motorsport).score).toEqual({
      kind: "classification",
      entries: [
        { position: 1, name: "Ari Stone", team: "Alpha Racing", time: "2:20:28.772" },
        { position: 2, name: "Ben Ash", team: "Beta Team", time: "+0.799" },
        { position: 3, name: "Cal Reed", team: "Gamma Team", time: "+4.006" },
      ],
    })
    const entries = parseClassification(riders.strResult)
    expect(entries?.map((entry) => entry.name)).toEqual(["Ari Stone", "Ben Ash", "Cal Reed"])
  })
  it("refuses a classification with an unknown nation or a gap in the order", () => {
    expect(parseClassification(f1Row(1, 3, "Atlantis Ari Stone", "A", "1:00.000") + "\r\n" + f1Row(2, 4, "Spain B", "B", "+1.0") + "\r\n" + f1Row(3, 5, "Spain C", "C", "+2.0"))).toBeNull()
    expect(parseClassification(f1Row(1, 3, "Spain A", "A", "1:00.000") + "\r\n" + f1Row(3, 4, "Spain B", "B", "+1.0") + "\r\n" + f1Row(4, 5, "Spain C", "C", "+2.0"))).toBeNull()
  })
  it("keeps no provider prose, which can name other publishers", () => {
    for (const event of [normalize(boxing, sports.combat), normalize(cricket, sports.cricket)]) {
      expect(JSON.stringify(event.score)).not.toMatch(/Source|example|Harbor/i)
    }
  })
})

describe("status mapping", () => {
  it("treats a stated result as finished when the source gives no status", () => {
    expect(normalize(tennis, sports.tennis).status).toBe("finished")
    expect(normalize(race, sports.motorsport).status).toBe("finished")
  })
  it("never calls a passed event upcoming when nothing confirms it", () => {
    const silent = { ...race, strResult: null }
    expect(normalize(silent, sports.motorsport).status).toBe("unknown")
    expect(normalize({ ...cricket, strStatus: null, intHomeScore: null, intAwayScore: null, strResult: null }, sports.cricket).status).toBe("unknown")
  })
  it("keeps a future event scheduled", () => {
    expect(normalize(session, sports.motorsport).status).toBe("scheduled")
  })
  it("does not finish a cricket match on a partial score", () => {
    expect(normalize({ ...cricket, strStatus: null, strResult: null }, sports.cricket).status).toBe("unknown")
  })
  it("honours stated statuses", () => {
    expect(normalize({ ...race, strStatus: "CANC", strResult: null }, sports.motorsport).status).toBe("canceled")
    expect(normalize({ ...cricket, strStatus: "ABD" }, sports.cricket).status).toBe("abandoned")
  })
  it("turns a stated no result into abandoned", () => {
    const event = normalize({ ...cricket, intHomeScore: null, intAwayScore: null, strResult: "No result (abandoned with a toss)" }, sports.cricket)
    expect(event).toMatchObject({ status: "abandoned", score: { kind: "none" } })
  })
  it("treats midnight with no local time as date only, but a real midnight start as a time", () => {
    expect(normalize(tennis, sports.tennis).dateOnly).toBe(true)
    expect(normalize({ ...tennis, strTimeLocal: "20:00:00" }, sports.tennis).dateOnly).toBe(false)
  })
  it("keeps a date-only event scheduled through its day", () => {
    const today = { ...tennis, strResult: null, strTimestamp: "2026-11-05T00:00:00" }
    expect(normalize(today, sports.tennis).status).toBe("scheduled")
  })
})

describe("spoiler mode", () => {
  const render = (event: SportEvent, spoilerMode: boolean) => {
    prefs.spoilerMode = spoilerMode
    return [
      renderToStaticMarkup(createElement(EventCard, { event, t, href: (path: string) => path })),
      renderToStaticMarkup(createElement(EventResult, { event, t })),
    ]
  }

  const secrets: [string, () => SportEvent, RegExp][] = [
    ["sets", () => normalize(tennis, sports.tennis), /2 6 6|6 3 3|Vale won/],
    ["retirement", () => normalize(retired, sports.tennis), /retired/],
    ["innings", () => normalize(cricket, sports.cricket), /269\/8|268\/9|won by/],
    ["combat", () => normalize(boxing, sports.combat), /won|split decision/],
    ["classification", () => normalize(race, sports.motorsport), /Ari Stone|Ben Ash|2:20:28/],
  ]

  it.each(secrets)("masks %s on the card and the match page", (_name, build, secret) => {
    for (const html of render(build(), true)) expect(html).not.toMatch(secret)
    expect(render(build(), false).join("")).toMatch(secret)
  })
  it("offers a reveal for each masked form", () => {
    for (const [, build] of secrets) expect(render(build(), true).join("")).toContain(t.spoiler.reveal.split(" ")[0])
  })
  it("does not put a classification's order in the title or an alert", () => {
    const event = normalize(race, sports.motorsport)
    expect(eventTitle(event)).toBe("Harbor Grand Prix")
    const alert = buildAlert(event, "final", { ...DEFAULT_PREFERENCES, spoilerMode: true })
    expect(JSON.stringify(alert.title + alert.body + alert.spoilerFreeBody)).not.toContain("Ari Stone")
  })
  it("keeps every result form out of a spoiler-safe alert", () => {
    for (const [, build, secret] of secrets) {
      const alert = buildAlert(build(), "final", { ...DEFAULT_PREFERENCES, spoilerMode: true })
      expect(alert.title + alert.body + alert.spoilerFreeBody).not.toMatch(secret)
    }
  })
})

describe("favorites on individuals", () => {
  it("follows a player, a fighter and a driver by name", () => {
    expect(followsEvent(["Vale"], normalize(tennis, sports.tennis))).toBe(true)
    expect(followsEvent(["Teo Álvarez"], normalize(boxing, sports.combat))).toBe(true)
    expect(followsEvent(["Cal Reed"], normalize(race, sports.motorsport))).toBe(true)
    expect(followsEvent(["Nobody"], normalize(race, sports.motorsport))).toBe(false)
  })
  it("does not link individuals to a team page", () => {
    prefs.spoilerMode = false
    const html = renderToStaticMarkup(createElement(EventCard, { event: normalize(tennis, sports.tennis), t, href: (path: string) => path }))
    expect(html).not.toContain("/app/team/")
    expect(html).not.toContain("/app/standings/")
  })
})

describe("reports and alerts stay grounded", () => {
  const stamp = NOW.toISOString()

  it("withholds a report when a sport has no structured result", () => {
    const silentRace = { ...normalize({ ...race, strResult: null, strStatus: "FT" }, sports.motorsport) }
    expect(withholdReason(silentRace)).toEqual({ status: "rejected", reason: "missing_score" })
    expect(buildReport(silentRace, "en", stamp, NOW)).toMatchObject({ status: "rejected", title: "", body: "", withheldReason: "missing_score" })
  })
  it("withholds when a card contradicts itself or the feed gave no sentence to trust", () => {
    const contradictory = normalize({ ...card, strStatus: "FT", strResult: `Sam Vale dethroned Tom Rook by unanimous decision.\r\n\r\n${cardTable}` }, sports.combat)
    expect(buildReport(contradictory, "en", stamp, NOW).withheldReason).toBe("missing_score")
  })
  it("withholds a cricket result with one side missing", () => {
    const partial = normalize({ ...cricket, intAwayScore: null, intAwayScoreExtra: null }, sports.cricket)
    expect(buildReport(partial, "en", stamp, NOW).withheldReason).toBe("missing_score")
  })
  it("writes a grounded report from a structured result, in both languages", () => {
    for (const raw of [[tennis, sports.tennis], [race, sports.motorsport], [boxing, sports.combat], [cricket, sports.cricket]] as const) {
      const event = normalize(raw[0], raw[1])
      for (const locale of ["en", "fr"] as const) {
        const report = buildReport(event, locale, stamp, NOW)
        expect(report.status, `${raw[1]} ${locale}`).toBe("validated")
        expect(isGrounded(report.body, event, locale)).toBe(true)
        expect(report.body).not.toMatch(/undefined|TBD/)
      }
    }
  })
  it("rejects a report carrying a number the event does not state", () => {
    expect(isGrounded("Vale won 9 9. ATP World Tour, November 1, 2026 (UTC).", normalize(tennis, sports.tennis), "en")).toBe(false)
  })
  it("fires a final alert only with a structured result", () => {
    expect(dueAlerts(normalize(tennis, sports.tennis), NOW)).toEqual(["final"])
    expect(dueAlerts(normalize({ ...race, strResult: null, strStatus: "FT" }, sports.motorsport), NOW)).toEqual([])
  })
  it("never announces a date-only event at midnight", () => {
    const today = normalize({ ...tennis, strResult: null, strTimestamp: "2026-11-05T00:00:00" }, sports.tennis)
    expect(dueAlerts(today, new Date("2026-11-05T00:05:00Z"))).toEqual([])
  })
  it("writes alerts for an event with no two sides", () => {
    const upcoming = normalize(session, sports.motorsport)
    const alert = buildAlert(upcoming, "start", { ...DEFAULT_PREFERENCES })
    expect(alert.title).toBe("Harbor Grand Prix Practice 3 is about to start")
    expect(alert.body).not.toMatch(/undefined/)
  })
  it("words a result without internal values", () => {
    expect(resultLine(normalize(boxing, sports.combat), t)).toBe("Teo Álvarez won, split decision")
    expect(resultLine(normalize(race, sports.motorsport), t)).toBe("1. Ari Stone, 2. Ben Ash, 3. Cal Reed")
    expect(resultLine(normalize(cricket, sports.cricket), t)).toBe("North Cricket won by 2 wickets: North Cricket 269/8, South Cricket 268/9")
  })
})

describe("predictions stay team score only", () => {
  it.each([[tennis, sports.tennis], [race, sports.motorsport], [boxing, sports.combat], [cricket, sports.cricket]] as const)("refuses %#", (raw, sport) => {
    expect(supportsScorePrediction(normalize(raw, sport))).toBe(false)
  })
})

describe("the feed", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
  const queried = (url: unknown) => new URL(String(url)).searchParams.get("s")

  beforeEach(() => {
    clearFeedCache()
    vi.useRealTimers()
  })

  it("never files one sport's record under another", async () => {
    vi.stubGlobal("fetch", async () => ok({ events: [tennis, race, { ...boxing, idEvent: "99", strSport: "Soccer" }] }))
    const feed = await getEvents({ date: "2026-11-01", sport: "tennis" })
    expect(feed.events.map((event) => [event.id, event.sportId])).toEqual([["tsdb-10", "tennis"]])
  })
  it("asks only for the sport requested", async () => {
    const asked: (string | null)[] = []
    vi.stubGlobal("fetch", async (url: unknown) => {
      asked.push(queried(url))
      return ok({ events: [] })
    })
    await getEvents({ date: "2026-11-01", sport: "combat-sports" })
    expect(asked).toEqual(["Fighting"])
  })
  it("keeps wrestling out of the list and off the match page", async () => {
    vi.stubGlobal("fetch", async () => ok({ events: [wrestling, boxing] }))
    const feed = await getEvents({ date: "2026-10-31", sport: "combat-sports" })
    expect(feed.events.map((event) => event.id)).toEqual(["tsdb-30"])
    clearFeedCache()
    expect(await getEvent("tsdb-33")).toBeNull()
  })
  it("degrades to stale when one sport fails and keeps the rest", async () => {
    vi.stubGlobal("fetch", async (url: unknown) =>
      queried(url) === "Tennis" ? ok({ events: [tennis] }) : queried(url) === "Motorsport" ? new Response("", { status: 429 }) : ok({ events: [] }),
    )
    const feed = await getEvents({ date: "2026-11-01" })
    expect(feed.state).toBe("stale")
    expect(feed.events.map((event) => event.id)).toEqual(["tsdb-10"])
  })
  it("survives a rate-limit page that is not JSON", async () => {
    vi.stubGlobal("fetch", async (url: unknown) => (queried(url) === "Tennis" ? ok({ events: [tennis] }) : new Response("<html>error 1015</html>", { status: 200 })))
    const feed = await getEvents({ date: "2026-11-01" })
    expect(feed.state).toBe("stale")
    expect(feed.events).toHaveLength(1)
  })
  it("finds an individual event by its feed sport", async () => {
    vi.stubGlobal("fetch", async () => ok({ events: [tennis] }))
    expect((await getEvent("tsdb-10"))?.sportId).toBe("tennis")
  })
})
