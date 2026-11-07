// Cricket from the second licensed source: scores, state of play and results for games the
// first source lists without a score, and for competitions it does not list at all.
// One match states its sides, a list of innings and one line of free text for the state of
// play. The text decides the status: the started and ended flags have been seen wrong both
// ways (a score on a match "not started", and a Test "ended" at stumps on day three).

import { cricketFormat, matchSide, readCricketText, type CricketReading } from "./cricket"
import type { CricketDetails, CricketFormat, CricketStage, EventScore, EventStatus, Innings, SportEvent } from "../types"

export interface RawCricketScore {
  r?: number | null
  w?: number | null
  o?: number | null
  inning?: string | null
}

export interface RawCricketMatch {
  id: string
  name?: string | null
  matchType?: string | null
  status?: string | null
  venue?: string | null
  date?: string | null
  dateTimeGMT?: string | null
  teams?: string[] | null
  teamInfo?: { name?: string | null; shortname?: string | null; img?: string | null }[] | null
  score?: RawCricketScore[] | null
  series_id?: string | null
  matchStarted?: boolean | null
  matchEnded?: boolean | null
}

export const CRICKET_DATA_PREFIX = "cd-"
const PROVIDER = "CricketData"
const DAY_MS = 86_400_000
/** Past this a stored state of play is too old to show as current. Results stay true. */
export const CRICKET_DATA_LIVE_LIMIT_MS = 3 * 3_600_000

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()

const twoInnings = (format: CricketFormat | null) => format === "test" || format === "first-class"
const SCHEDULED_DAYS: Partial<Record<CricketFormat, number>> = { test: 5, "first-class": 4 }

interface NameParts {
  label: string | null
  stage: CricketStage | null
  group: string | null
  series: string | null
  season: string | null
}

/** "Sri Lanka U19 vs Bangladesh U19, 6th Match, Group B, ACC Mens U19 Asia Cup 2026". */
export function nameParts(name: string | null | undefined): NameParts {
  const parts = (name ?? "").split(",").map((part) => part.trim()).filter(Boolean)
  const [, match = "", ...rest] = parts
  const group = rest[0] && /^group\s+\w+$/i.test(rest[0]) ? rest[0] : null
  const series = (group ? rest.slice(1) : rest).join(", ") || null
  const stage: CricketStage | null = /^final$/i.test(match) ? "final" : /semi-?\s?final/i.test(match) ? "semi-final" : /eliminator/i.test(match) ? "eliminator" : /qualifier/i.test(match) ? "qualifier" : /play-?off/i.test(match) ? "playoff" : null
  return {
    label: /^\d{1,3}(?:st|nd|rd|th)\b/i.test(match) ? match : null,
    stage,
    group,
    series,
    season: series?.match(/\b(\d{4}(?:[-/]\d{2,4})?)$/)?.[1] ?? null,
  }
}

/** An unofficial Test is an A-team first-class match, two innings over four days. */
export function cricketDataFormat(match: Pick<RawCricketMatch, "matchType" | "name">): CricketFormat | null {
  const { label, series } = nameParts(match.name)
  const type = (match.matchType ?? "").toLowerCase()
  const said = label ?? ""
  if (type === "test" || /\btest\b/i.test(said)) return /unofficial/i.test(said) ? "first-class" : "test"
  if (type === "odi") return "odi"
  if (type === "t20") return "t20"
  if (/\bodi\b/i.test(said)) return "odi"
  if (/\bt20i?\b/i.test(said)) return "t20"
  return cricketFormat(series)
}

/** The side an innings label names. "Bangladesh,West Indies Inning 1" is Bangladesh's innings. */
export function inningsSide(label: string | null | undefined, teams: string[]): number | null {
  const name = (label ?? "").replace(/\s+innings?\s*\d*\s*$/i, "").split(",")[0].trim()
  if (!name) return null
  const exact = teams.findIndex((team) => fold(team) === fold(name))
  return exact !== -1 ? exact : matchSide(name, teams)
}

const inningsNumber = (label: string | null | undefined) => Number((label ?? "").match(/innings?\s*(\d+)\s*$/i)?.[1]) || 1

function inningsOf(row: RawCricketScore): Innings | null {
  const runs = row.r
  if (typeof runs !== "number" || !Number.isInteger(runs) || runs < 0) return null
  const wickets = typeof row.w === "number" && Number.isInteger(row.w) && row.w >= 0 && row.w <= 10 ? row.w : null
  const overs = typeof row.o === "number" && Number.isFinite(row.o) && row.o >= 0 ? String(row.o) : null
  return { runs, wickets, overs }
}

/** Each side's innings in batting order. A label that fits neither side is left out. */
export function sideInnings(match: Pick<RawCricketMatch, "score">, teams: string[]): Innings[][] {
  const found: { number: number; at: number; innings: Innings }[][] = teams.map(() => [])
  ;(match.score ?? []).forEach((row, at) => {
    const side = inningsSide(row.inning, teams)
    const innings = inningsOf(row)
    if (side !== null && innings) found[side].push({ number: inningsNumber(row.inning), at, innings })
  })
  return found.map((list) => list.sort((a, b) => a.number - b.number || a.at - b.at).map((item) => item.innings))
}

const TOSS = /(?:^|[-:]\s*)([^-:]+?)\s+(?:opt|opts|opted|elect|elects|elected|chose|choose|chooses)\s+to\s+(bat|bowl|field)\b/i

function tossOf(text: string, teams: string[], reading: CricketReading): CricketDetails["toss"] {
  const said = text.match(TOSS)
  const side = said ? matchSide(said[1].trim(), teams) : null
  if (said && side !== null) return { side: teams[side], choice: said[2].toLowerCase() === "bat" ? "bat" : "field" }
  return reading.toss
}

/** The text first; the flags only where the text names no result. */
export function cricketDataStatus(match: RawCricketMatch, format: CricketFormat | null, reading: CricketReading, scored: boolean): EventStatus {
  const text = match.status ?? ""
  if (reading.outcome === "no-result") return "abandoned"
  if (reading.outcome) return "finished"
  if (/\bpostponed\b/i.test(text)) return "postponed"
  if (/\bcancell?ed\b/i.test(text)) return "canceled"
  if (!scored && /\b(?:not started|starts? at|yet to (?:begin|start))\b/i.test(text)) return "scheduled"
  if (match.matchEnded && !twoInnings(format) && scored) return "finished"
  if (scored || match.matchStarted || /\b(?:day \d|stumps|session|innings break|need|trail|lead|opt|elected|chose)\b/i.test(text)) return "live"
  return "scheduled"
}

function startOf(match: Pick<RawCricketMatch, "dateTimeGMT" | "date">): { start: string | null; dateOnly: boolean } {
  const time = match.dateTimeGMT?.trim()
  const parsed = time ? new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(time) ? time : `${time}Z`) : null
  if (parsed && !Number.isNaN(parsed.getTime())) return { start: parsed.toISOString(), dateOnly: false }
  const day = match.date?.trim().match(/^\d{4}-\d{2}-\d{2}$/)?.[0]
  return day ? { start: `${day}T00:00:00.000Z`, dateOnly: true } : { start: null, dateOnly: false }
}

const GENERIC_BADGE = /\/icon512\.png$/i

function badgeOf(match: RawCricketMatch, team: string): string | null {
  const url = match.teamInfo?.find((info) => info.name && fold(info.name) === fold(team))?.img?.trim()
  return url && /^https:\/\//.test(url) && !GENERIC_BADGE.test(url) ? url : null
}

export interface CricketDataMatch {
  raw: RawCricketMatch
  teams: [string, string]
  format: CricketFormat | null
  status: EventStatus
  innings: Innings[][]
  reading: CricketReading
  details: CricketDetails
  start: string | null
  dateOnly: boolean
  competition: string
}

/** Null for a match that does not name two sides and a competition. */
export function readCricketDataMatch(raw: RawCricketMatch): CricketDataMatch | null {
  const teams = (raw.teams ?? []).map((team) => (typeof team === "string" ? team.trim() : ""))
  const parts = nameParts(raw.name)
  if (!raw.id || teams.length !== 2 || !teams[0] || !teams[1] || !parts.series) return null
  const sides = teams as [string, string]
  const text = raw.status?.trim() ?? ""
  const format = cricketDataFormat(raw)
  const reading = readCricketText(text, sides)
  const innings = sideInnings(raw, sides)
  const status = cricketDataStatus(raw, format, reading, innings.some((list) => list.length > 0))
  const { start, dateOnly } = startOf(raw)
  const details: CricketDetails = {
    kind: "cricket",
    format,
    scheduledDays: format ? SCHEDULED_DAYS[format] ?? null : null,
    stage: parts.stage,
    matchLabel: parts.label,
    round: null,
    season: parts.season,
    group: parts.group,
    phase: null,
    umpires: null,
    dayNight: false,
    city: null,
    country: null,
    women: /\bwomens?\b/i.test(`${sides.join(" ")} ${parts.series}`),
    toss: tossOf(text, sides, reading),
    spectators: null,
    statusNote: text || null,
  }
  return { raw, teams: sides, format, status, innings, reading, details, start, dateOnly, competition: parts.series }
}

/** "46 Overs game due to rain": the overs a side was given, where the text says so. */
const reducedOvers = (text: string, reading: CricketReading) => reading.reducedOvers ?? (Number(text.match(/\b(\d{1,2}) overs? (?:a side )?game\b/i)?.[1]) || null)

/**
 * The score in the order of `order`, which lists this match's side indexes as the page shows
 * them, under the names in `names`. A side that has not batted stays null.
 */
function scoreOf(match: CricketDataMatch, order: [number, number], names: [string, string]): EventScore {
  const { reading, innings, status } = match
  if (status === "scheduled" || status === "postponed" || status === "canceled") return { kind: "none" }
  const shown = order.map((index) => innings[index]) as [Innings[], Innings[]]
  const winnerIndex = reading.winner ? match.teams.indexOf(reading.winner) : -1
  const winner = winnerIndex === -1 ? null : names[order.indexOf(winnerIndex)]
  const overs = reducedOvers(match.raw.status ?? "", reading)
  const facts = {
    winner,
    margin: winner ? reading.margin : null,
    ...(reading.outcome ? { outcome: reading.outcome } : {}),
    ...(reading.byInnings ? { byInnings: true } : {}),
    ...(reading.ballsLeft ? { ballsLeft: reading.ballsLeft } : {}),
    ...(reading.method ? { method: reading.method } : {}),
    ...(reading.rain ? { rain: true } : {}),
    ...(overs ? { reducedOvers: overs } : {}),
    ...(reading.revisedOvers ? { revisedOvers: reading.revisedOvers } : {}),
    ...(reading.target ? { target: reading.target } : {}),
  }
  if (shown.every((list) => list.length === 0)) return reading.outcome && reading.outcome !== "no-result" ? { kind: "innings", home: null, away: null, ...facts } : { kind: "none" }
  if (twoInnings(match.format)) {
    const total = (list: Innings[]): Innings | null => (list.length ? { runs: list.reduce((sum, item) => sum + item.runs, 0), wickets: null, overs: null } : null)
    return {
      kind: "innings",
      home: total(shown[0]),
      away: total(shown[1]),
      ...facts,
      ...(shown[0].length ? { homeInnings: shown[0] } : {}),
      ...(shown[1].length ? { awayInnings: shown[1] } : {}),
    }
  }
  return { kind: "innings", home: shown[0][0] ?? null, away: shown[1][0] ?? null, ...facts }
}

export function cricketDataEvent(match: CricketDataMatch, fetchedAt: number | null): SportEvent {
  const { raw, teams } = match
  return {
    id: `${CRICKET_DATA_PREFIX}${raw.id}`,
    sportId: "cricket",
    eventType: "match",
    participantType: "team",
    participants: teams.map((name, index) => ({ id: null, name, role: index === 0 ? ("home" as const) : ("away" as const), badgeUrl: badgeOf(raw, name) })),
    competition: { id: null, name: match.competition, country: null },
    scheduledStartUTC: match.start,
    dateOnly: match.dateOnly,
    status: match.status,
    details: match.details,
    providerStatus: raw.status?.trim() || null,
    score: scoreOf(match, [0, 1], teams),
    venue: raw.venue?.trim() || null,
    provider: { name: PROVIDER, eventId: raw.id },
    sourceUpdatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
    coverageFlags: { liveScores: true, statistics: false, video: false },
  }
}

const ALIASES: Record<string, string> = { uae: "united arab emirates", usa: "united states of america", "united states": "united states of america" }

/**
 * A side's name with the words one source adds and the other leaves off. "Cricket" goes;
 * "Women", "U19" and "A" stay, because they name a different side: India U19 is not India.
 */
export function teamKey(name: string): string {
  const plain = fold(name)
    .replace(/\bwomen'?s\b/g, "women")
    .replace(/\bunder[\s-]?(\d{2})s?\b/g, "u$1")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\bcricket\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return ALIASES[plain] ?? plain
}

/** "same" when the sides line up in order, "swapped" when they are the other way round. */
export function sameSides(a: string[], b: string[]): "same" | "swapped" | null {
  if (a.length !== 2 || b.length !== 2) return null
  const [a0, a1, b0, b1] = [a[0], a[1], b[0], b[1]].map(teamKey)
  if (!a0 || !a1 || a0 === a1) return null
  if (a0 === b0 && a1 === b1) return "same"
  return a0 === b1 && a1 === b0 ? "swapped" : null
}

const dayNumber = (iso: string | null) => (iso ? Math.floor(Date.parse(iso.slice(0, 10)) / DAY_MS) : Number.NaN)

/** Within a day either way, by date: the two sources file a late start under different days. */
function closeness(event: Pick<SportEvent, "scheduledStartUTC">, match: CricketDataMatch): number | null {
  if (!event.scheduledStartUTC || !match.start) return null
  if (Math.abs(dayNumber(event.scheduledStartUTC) - dayNumber(match.start)) > 1) return null
  return Math.abs(Date.parse(event.scheduledStartUTC) - Date.parse(match.start))
}

const settled = (status: EventStatus) => status === "finished" || status === "abandoned" || status === "canceled"

/**
 * One event from both sources: the first source's id, sides and facts, with this source's
 * score, state of play and status in the first source's side order and names.
 */
export function fillFromCricketData(event: SportEvent, match: CricketDataMatch, fetchedAt: number | null): SportEvent {
  const names = event.participants.map((side) => side.name) as [string, string]
  const order = sameSides(names, match.teams)
  if (!order || match.status === "scheduled") return event
  // An older state of play never undoes a result the first source already has.
  if (settled(event.status) && !settled(match.status)) return event
  const indexes: [number, number] = order === "same" ? [0, 1] : [1, 0]
  const base = event.details?.kind === "cricket" ? event.details : match.details
  const toss = base.toss ?? (match.details.toss ? { ...match.details.toss, side: names[indexes.indexOf(match.teams.indexOf(match.details.toss.side))] } : null)
  return {
    ...event,
    status: match.status,
    score: scoreOf(match, indexes, names),
    details: { ...base, format: base.format ?? match.format, scheduledDays: base.scheduledDays ?? match.details.scheduledDays, toss, statusNote: match.details.statusNote },
    sourceUpdatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : event.sourceUpdatedAt,
    coverageFlags: { ...event.coverageFlags, liveScores: true },
  }
}

/** Matches whose state of play can still be shown. A result stays good however old the read. */
export function usableMatches(raw: RawCricketMatch[], fetchedAt: number, now: number): CricketDataMatch[] {
  const fresh = now - fetchedAt <= CRICKET_DATA_LIVE_LIMIT_MS
  return raw.flatMap((item) => readCricketDataMatch(item) ?? []).filter((match) => fresh || settled(match.status))
}

/** The best match for one event, for a single match page. */
export function matchFor(event: SportEvent, matches: CricketDataMatch[]): CricketDataMatch | null {
  if (event.sportId !== "cricket" || event.participants.length !== 2) return null
  let best: { match: CricketDataMatch; gap: number } | null = null
  for (const match of matches) {
    const gap = closeness(event, match)
    if (gap === null || !sameSides(event.participants.map((side) => side.name), match.teams)) continue
    if (!best || gap < best.gap) best = { match, gap }
  }
  return best?.match ?? null
}

/**
 * The page's day with both sources as one list. `nearby` holds the first source's games on
 * the days around, so a game it files under the next day is filled there rather than shown
 * twice. Each match fills at most one event, the nearest in time. A match left over is shown
 * on its own on the day it starts and, while a Test is unfinished, on each later day it is due.
 */
export function mergeCricketData(day: SportEvent[], nearby: SportEvent[], matches: CricketDataMatch[], date: string, fetchedAt: number | null, today: string): SportEvent[] {
  const seen = new Set<string>()
  const pool = [...day, ...nearby].filter((event) => event.sportId === "cricket" && event.participants.length === 2 && !seen.has(event.id) && seen.add(event.id))
  const pairs: { event: string; match: number; gap: number }[] = []
  matches.forEach((match, index) => {
    for (const event of pool) {
      const gap = closeness(event, match)
      if (gap !== null && sameSides(event.participants.map((side) => side.name), match.teams)) pairs.push({ event: event.id, match: index, gap })
    }
  })
  pairs.sort((a, b) => a.gap - b.gap)
  const filled = new Map<string, number>()
  const used = new Set<number>()
  for (const pair of pairs) {
    if (filled.has(pair.event) || used.has(pair.match)) continue
    filled.set(pair.event, pair.match)
    used.add(pair.match)
  }
  const merged = day.map((event) => (filled.has(event.id) ? fillFromCricketData(event, matches[filled.get(event.id) as number], fetchedAt) : event))
  const own = matches.flatMap((match, index) => {
    if (used.has(index) || !match.start) return []
    const offset = dayNumber(`${date}T00:00:00Z`) - dayNumber(match.start)
    if (offset === 0) return [cricketDataEvent(match, fetchedAt)]
    const days = match.details.scheduledDays
    if (offset < 1 || !days || offset >= days || date > today || settled(match.status)) return []
    const event = cricketDataEvent(match, fetchedAt)
    return [{ ...event, details: { ...match.details, matchDay: offset + 1 } }]
  })
  return [...merged, ...own]
}
