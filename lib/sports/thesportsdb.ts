import { parseCard, parseClassification, parseCombatResult, parseCricketOutcome, parseCricketOvers, parseTennisDraw, parseTennisResult } from "./results"
import type { EventScore, EventStatus, Innings, Participant, SportEvent, SportId } from "./types"

export const PROVIDER_NAME = "TheSportsDB"

export interface RawEvent {
  idEvent: string
  idLeague?: string | null
  strLeague?: string | null
  strSport?: string | null
  strEvent?: string | null
  strResult?: string | null
  strDescriptionEN?: string | null
  strTime?: string | null
  strTimeLocal?: string | null
  strCity?: string | null
  intHomeScoreExtra?: string | number | null
  intAwayScoreExtra?: string | number | null
  strCountry?: string | null
  strHomeTeam?: string | null
  strAwayTeam?: string | null
  idHomeTeam?: string | null
  idAwayTeam?: string | null
  strHomeTeamBadge?: string | null
  strAwayTeamBadge?: string | null
  intHomeScore?: string | number | null
  intAwayScore?: string | number | null
  strStatus?: string | null
  strTimestamp?: string | null
  strVenue?: string | null
  strVideo?: string | null
  strThumb?: string | null
  strPostponed?: string | null
}

const FINISHED = new Set(["FT", "AET", "PEN", "AOT", "MATCH FINISHED", "FINISHED"])
const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "Q1", "Q2", "Q3", "Q4", "OT", "LIVE", "IN PLAY"])
const SCHEDULED = new Set(["NS", "NOT STARTED", "TBD", ""])

export function normalizeStatus(raw: RawEvent): EventStatus {
  if (raw.strPostponed?.toLowerCase() === "yes") return "postponed"
  const status = (raw.strStatus ?? "").trim().toUpperCase()
  if (FINISHED.has(status)) return "finished"
  if (LIVE.has(status)) return "live"
  if (SCHEDULED.has(status)) return "scheduled"
  if (status === "PST" || status === "POSTPONED") return "postponed"
  if (status === "CANC" || status === "CANCELLED" || status === "CANCELED") return "canceled"
  if (status === "SUSP" || status === "INT" || status === "INTERRUPTED") return "interrupted"
  if (status === "ABD" || status === "ABANDONED") return "abandoned"
  return "unknown"
}

function parseScore(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

/** A missing score stays "none": unavailable values must never appear as zero. */
export function normalizeScore(raw: RawEvent, status: EventStatus): EventScore {
  if (status === "scheduled" || status === "postponed" || status === "canceled") return { kind: "none" }
  const home = parseScore(raw.intHomeScore)
  const away = parseScore(raw.intAwayScore)
  return home === null || away === null ? { kind: "none" } : { kind: "team", home, away }
}

export function toUtc(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  const iso = timestamp.trim().replace(" ", "T")
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  const date = new Date(hasZone ? iso : `${iso}Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// The fighting feed mixes real contests with scripted pro wrestling, and an unknown
// promotion must stay out rather than be shown as a combat result.
const COMBAT_LEAGUES = /\b(?:ufc|boxing|mma|bkfc|pfl|bellator|rizin|ksw|cage warriors|kickboxing|muay thai|glory|jungle fight)\b/i

/** False for a record the sport's feed returns but this product does not cover. */
export function isCovered(raw: RawEvent, sportId: SportId): boolean {
  if (sportId !== "combat-sports") return true
  return raw.strLeague === "ONE" || COMBAT_LEAGUES.test(raw.strLeague ?? "")
}

const competitor = (name: string): Participant => ({ id: null, name, role: "competitor", badgeUrl: null })

/** Midnight with no local time is how the source writes "date only". */
const isDateOnly = (raw: RawEvent) => raw.strTime === "00:00:00" && (!raw.strTimeLocal || raw.strTimeLocal === "00:00:00")

/**
 * These feeds rarely state a status, even long after an event. A confirmed result
 * means it finished; otherwise a passed start is unconfirmed, never "upcoming".
 */
function inferStatus(raw: RawEvent, settled: boolean, now: Date): EventStatus {
  const stated = normalizeStatus(raw)
  if (stated !== "scheduled") return stated
  if (settled) return "finished"
  const start = toUtc(raw.strTimestamp)
  if (!start) return "unknown"
  const startsBy = Date.parse(start) + (isDateOnly(raw) ? 86_400_000 : 0)
  return now.getTime() < startsBy ? "scheduled" : "unknown"
}

const hidesResult = (status: EventStatus) => status === "scheduled" || status === "postponed" || status === "canceled"

function parseWickets(value: string | number | null | undefined): number | null {
  const wickets = parseScore(value)
  return wickets !== null && wickets <= 10 ? wickets : null
}

function inningsOf(raw: RawEvent, runs: string | number | null | undefined, wickets: string | number | null | undefined, side: string): Innings | null {
  const total = parseScore(runs)
  return total === null ? null : { runs: total, wickets: parseWickets(wickets), overs: parseCricketOvers(raw.strResult, side, total) }
}

function cricketEvent(raw: RawEvent, base: Pick<SportEvent, "participants">, now: Date) {
  const sides = base.participants.map((participant) => participant.name)
  const outcome = parseCricketOutcome(raw.strResult, sides)
  const noResult = /^no result\b/i.test((raw.strResult ?? "").trim())
  const stated = inferStatus(raw, Boolean(outcome), now)
  const status: EventStatus = noResult && stated === "finished" ? "abandoned" : stated

  // A test side bats twice and the feed has one number per side, which would flatten two innings.
  const flattened = /\btest\b/i.test(raw.strLeague ?? "")
  const home = inningsOf(raw, raw.intHomeScore, raw.intHomeScoreExtra, sides[0])
  const away = inningsOf(raw, raw.intAwayScore, raw.intAwayScoreExtra, sides[1])
  const score: EventScore =
    hidesResult(status) || flattened || (!home && !away)
      ? { kind: "none" }
      : { kind: "innings", home, away, winner: outcome?.winner ?? null, margin: outcome?.margin ?? null }
  return { status, score }
}

function tennisFields(raw: RawEvent, now: Date) {
  const title = raw.strEvent?.trim() || null
  const result = parseTennisResult(raw.strResult)
  const draw = parseTennisDraw(raw.strDescriptionEN)
  const at = (name: string) => title?.indexOf(name) ?? -1
  // Draw order, not result order: the source lists the winner first.
  const names = result ? result.lines.map((line) => line.name).sort((a, b) => at(a) - at(b)) : draw?.names ?? []
  const status = inferStatus(raw, Boolean(result && (result.winner || result.retired)), now)
  const tail = names.length === 2 ? ` ${names[0]} vs ${names[1]}` : null
  const eventName = draw?.tournament ?? (tail && title?.endsWith(tail) ? title.slice(0, -tail.length) : title)
  return {
    eventType: "match" as const,
    participantType: names.some((name) => name.includes("/")) ? ("pair" as const) : ("individual" as const),
    participants: names.map(competitor),
    eventName,
    status,
    score: result && !hidesResult(status) ? ({ kind: "sets", ...result } as const) : ({ kind: "none" } as const),
  }
}

function combatFields(raw: RawEvent, now: Date) {
  const title = raw.strEvent?.trim() || null
  const parsed = title ? parseCard(title, raw.strLeague === "Boxing") : null
  const result = parsed ? parseCombatResult(raw.strResult, parsed.names) : null
  const status = inferStatus(raw, Boolean(result), now)
  return {
    eventType: parsed && !parsed.card ? ("bout" as const) : ("fight-card" as const),
    participantType: "individual" as const,
    participants: parsed ? parsed.names.map(competitor) : [],
    eventName: parsed ? parsed.card : title,
    status,
    score: result && !hidesResult(status) ? ({ kind: "combat", ...result } as const) : ({ kind: "none" } as const),
  }
}

function motorsportFields(raw: RawEvent, now: Date) {
  const entries = parseClassification(raw.strResult)
  const status = inferStatus(raw, Boolean(entries), now)
  const shown = entries && !hidesResult(status) ? entries : null
  return {
    eventType: "session" as const,
    participantType: "entrant" as const,
    participants: shown ? shown.map((entry) => competitor(entry.name)) : [],
    eventName: raw.strEvent?.trim() || null,
    status,
    score: shown ? ({ kind: "classification", entries: shown } as const) : ({ kind: "none" } as const),
  }
}

export function normalizeEvent(raw: RawEvent, sportId: SportId, now: Date = new Date()): SportEvent {
  const shared = {
    id: `tsdb-${raw.idEvent}`,
    sportId,
    competition: { id: raw.idLeague ?? null, name: raw.strLeague || "Unknown competition", country: raw.strCountry ?? null },
    scheduledStartUTC: toUtc(raw.strTimestamp),
    providerStatus: raw.strStatus ?? null,
    venue: raw.strVenue || null,
    provider: { name: PROVIDER_NAME, eventId: raw.idEvent },
    sourceUpdatedAt: null,
    videoUrl: raw.strVideo || null,
    thumbnailUrl: raw.strThumb || null,
    coverageFlags: { liveScores: false, statistics: false, video: false },
  }
  const teams = {
    eventType: "match" as const,
    participantType: "team" as const,
    participants: [
      { id: raw.idHomeTeam ?? null, name: raw.strHomeTeam || "TBD", role: "home" as const, badgeUrl: raw.strHomeTeamBadge ?? null },
      { id: raw.idAwayTeam ?? null, name: raw.strAwayTeam || "TBD", role: "away" as const, badgeUrl: raw.strAwayTeamBadge ?? null },
    ],
  }

  if (sportId === "cricket") return { ...shared, ...teams, ...cricketEvent(raw, teams, now), dateOnly: isDateOnly(raw) }
  const individual = { dateOnly: isDateOnly(raw), venue: raw.strVenue || raw.strCity || null }
  if (sportId === "tennis") return { ...shared, ...individual, ...tennisFields(raw, now) }
  if (sportId === "combat-sports") return { ...shared, ...individual, ...combatFields(raw, now) }
  if (sportId === "motorsport") return { ...shared, ...individual, ...motorsportFields(raw, now) }

  const status = normalizeStatus(raw)
  return { ...shared, ...teams, status, score: normalizeScore(raw, status) }
}
