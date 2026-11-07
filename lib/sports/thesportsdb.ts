import { combatFields } from "./adapters/combat"
import { cricketFields } from "./adapters/cricket"
import { footballClock, footballDetails, footballStateExpired } from "./adapters/football"
import { motorsportFields } from "./adapters/motorsport"
import { tennisFields } from "./adapters/tennis"
import { americanFootballConclusion, americanFootballDetails, americanFootballRow } from "./adapters/american-football"
import { baseballRow, baseballStopped } from "./adapters/baseball"
import { basketballDetails, basketballRow } from "./adapters/basketball"
import { hockeyCancelUnconfirmed, hockeyClock, hockeyRow } from "./adapters/ice-hockey"
import { rugbyDetails, rugbyRow } from "./adapters/rugby"
import { teamBreakdown, teamPhase } from "./adapters/team"
import { volleyballDetails, volleyballRow } from "./adapters/volleyball"
import type { EventConclusion, EventScore, EventStatus, Participant, SportEvent, SportId } from "./types"

export const PROVIDER_NAME = "TheSportsDB"

/** One entrant's line from the results endpoint. Its points are 0 even for a race winner, so they are not read. */
export interface RawResult {
  idPlayer?: string | null
  strPlayer?: string | null
  intPosition?: string | number | null
  strDetail?: string | null
}

export interface RawEvent {
  /** Set when the live feed's status and scores were laid over the stored row. */
  fromLive?: boolean
  idEvent: string
  idLeague?: string | null
  strLeague?: string | null
  strSport?: string | null
  strEvent?: string | null
  /** The source's own file name for the game, "League date Home vs Away" unless the row is reversed. */
  strFilename?: string | null
  dateEvent?: string | null
  strSeason?: string | null
  strGroup?: string | null
  intSpectators?: string | number | null
  /** Added by this site from the results endpoint, which many sessions and matches need. */
  resultRows?: RawResult[] | null
  resultsCheckedAt?: number
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
  /** Added from the live feed: minutes played, or the clock in the current period. */
  strProgress?: string | null
  intRound?: string | number | null
}

const FINISHED = new Set(["FT", "AET", "PEN", "AOT", "AP", "AWD", "AW", "WO", "MATCH FINISHED", "FINISHED"])
const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "PT", "SO", "Q1", "Q2", "Q3", "Q4", "OT", "LIVE", "IN PLAY"])
const SCHEDULED = new Set(["NS", "NOT STARTED", "TBD", ""])

// Hockey periods, baseball innings and volleyball sets, as the live feed writes them.
const LIVE_PERIOD = /^(?:P[1-5]|IN\d{1,2}|ET\d|S[1-5])$/

export function normalizeStatus(raw: RawEvent): EventStatus {
  if (raw.strPostponed?.toLowerCase() === "yes") return "postponed"
  const status = (raw.strStatus ?? "").trim().toUpperCase()
  if (FINISHED.has(status)) return "finished"
  if (LIVE.has(status) || LIVE_PERIOD.test(status)) return "live"
  if (SCHEDULED.has(status)) return "scheduled"
  if (status === "PST" || status === "POST" || status === "POSTPONED") return "postponed"
  if (status === "CANC" || status === "CANCELLED" || status === "CANCELED") return "canceled"
  if (status === "SUSP" || status === "INT" || status === "INTR" || status === "INTERRUPTED") return "interrupted"
  if (status === "ABD" || status === "ABANDONED") return "abandoned"
  return "unknown"
}

const CONCLUSIONS: Record<string, EventConclusion> = { AET: "extra-time", AOT: "overtime", PEN: "penalties", AWD: "awarded", WO: "walkover" }

/** "AP" is the same state as "PEN", and hockey calls it a shootout. */
function conclusionOf(raw: RawEvent, sportId: SportId): EventConclusion | null {
  const status = (raw.strStatus ?? "").trim().toUpperCase()
  if (status === "AP") return sportId === "ice-hockey" ? "shootout" : "penalties"
  return CONCLUSIONS[status] ?? null
}

export type PeriodKey = "first-half" | "second-half" | "half-time" | "extra-time" | "extra-break" | "shootout" | "overtime" | "quarter" | "period" | "inning" | "set" | "break"

/** The running period of a live game, in a form the page can translate. Raw codes never reach a visitor. */
export function currentPeriod(status: string | null | undefined, sportId?: SportId, league?: string | null): { key: PeriodKey; number?: number } | null {
  const code = (status ?? "").trim().toUpperCase()
  const own = sportId ? teamPhase(sportId, code, league) : null
  if (own) return own
  const fixed: Record<string, PeriodKey> = { "1H": "first-half", "2H": "second-half", HT: "half-time", ET: "extra-time", BT: "extra-break", P: "shootout", OT: "overtime" }
  if (fixed[code]) return { key: fixed[code] }
  const numbered = code.match(/^(Q|P|IN|ET)(\d{1,2})$/)
  if (!numbered) return null
  const number = Number(numbered[2])
  return { key: numbered[1] === "Q" ? "quarter" : numbered[1] === "P" ? "period" : numbered[1] === "IN" ? "inning" : "extra-time", number }
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
const COMBAT_LEAGUES = /\b(?:ufc|boxing|mma|mixed martial arts|bkfc|pfl|professional fighters league|bellator|rizin|ksw|cage warriors|caged steel|cage fury|legacy fighting alliance|uae warriors|kotc|deep|invicta|aca|pancrase|shooto|pride fc|dream|strikeforce|world extreme cagefighting|top rank|kickboxing|muay thai|glory|k-1|kok|rise|jungle fight)\b/i
// Promotions whose short names are too plain to match by pattern: Knock Out and K-1 Japan
// kickboxing, and MMA and kickboxing promotions now closed whose cards are still listed.
const COMBAT_NAMES = new Set(["ONE", "KO", "KJP", "SRC", "Heros", "EliteXC", "Affliction", "IFL", "Its Showtime", "VTJ", "IVC", "Meca", "RINGS"])

/** False for a record the sport's feed returns but this product does not cover. */
export function isCovered(raw: RawEvent, sportId: SportId): boolean {
  if (sportId !== "combat-sports") return true
  return COMBAT_NAMES.has(raw.strLeague ?? "") || COMBAT_LEAGUES.test(raw.strLeague ?? "")
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

// Long enough for extra time or a slow baseball game.
const LONGEST_GAME_MS = 8 * 3_600_000

/**
 * Regional games often stop updating part way through, which leaves a final-looking
 * "2H" or "NS" on the record. A game that long past its start is not live or upcoming.
 */
function settledStatus(raw: RawEvent, now: Date, sportId: SportId): EventStatus {
  const status = normalizeStatus(raw)
  if (sportId === "ice-hockey" && status === "canceled" && hockeyCancelUnconfirmed(toUtc(raw.strTimestamp), now)) return "scheduled"
  if (status !== "live" && status !== "scheduled") return status
  const start = toUtc(raw.strTimestamp)
  if (!start) return status
  if (sportId === "football" && !isDateOnly(raw) && footballStateExpired(raw, Date.parse(start), now)) return "unknown"
  // Midnight UTC is 7pm in New York all winter, and NHL, AHL and college rows at that hour
  // carry no local time (checked on 1,036 rows, 6 November 2026), so for hockey it is a real start.
  const limit = LONGEST_GAME_MS + (isDateOnly(raw) && sportId !== "ice-hockey" ? 86_400_000 : 0)
  return now.getTime() - Date.parse(start) > limit ? "unknown" : status
}

const hidesResult = (status: EventStatus) => status === "scheduled" || status === "postponed" || status === "canceled"

function finish(raw: RawEvent, sportId: SportId): Pick<SportEvent, "conclusion" | "shootout"> {
  const conclusion = conclusionOf(raw, sportId) ?? (sportId === "american-football" ? americanFootballConclusion(raw.strResult) : null)
  if (!conclusion) return {}
  const [home, away] = [parseScore(raw.intHomeScoreExtra), parseScore(raw.intAwayScoreExtra)]
  const decided = conclusion === "penalties" || conclusion === "shootout"
  return { conclusion, ...(decided && home !== null && away !== null ? { shootout: { home, away } } : {}) }
}

export function normalizeEvent(row: RawEvent, sportId: SportId, now: Date = new Date()): SportEvent {
  const raw = sportId === "basketball" ? basketballRow(row) : sportId === "ice-hockey" ? hockeyRow(row) : sportId === "american-football" ? americanFootballRow(row) : sportId === "baseball" ? baseballRow(row, now) : sportId === "rugby" ? rugbyRow(row, toUtc(row.strTimestamp), now) : sportId === "volleyball" ? volleyballRow(row, now) : row
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

  const infer = (settled: boolean) => inferStatus(raw, settled, now)
  if (sportId === "cricket") return { ...shared, ...teams, ...cricketFields(raw, teams.participants.map((side) => side.name), infer), dateOnly: isDateOnly(raw) }
  const individual = { dateOnly: isDateOnly(raw), venue: raw.strVenue || raw.strCity || null }
  if (sportId === "tennis") return { ...shared, ...individual, ...tennisFields(raw, infer) }
  if (sportId === "combat-sports") return { ...shared, ...individual, ...combatFields(raw, infer) }
  if (sportId === "motorsport") return { ...shared, ...individual, ...motorsportFields(raw, infer) }

  const status = settledStatus(raw, now, sportId)
  const progress = sportId === "football" ? footballClock(raw.strStatus, raw.strProgress) : sportId === "ice-hockey" ? hockeyClock(raw.strStatus, raw.strProgress) : raw.strProgress
  const clock = status === "live" && progress ? progress : null
  // The score follows what the source stated: a game it never started has no score, however old.
  const score = normalizeScore(raw, normalizeStatus(raw))
  const breakdown = (status === "finished" || (sportId === "baseball" && baseballStopped(status))) && score.kind === "team"
    ? teamBreakdown(raw.strResult, sportId, { home: teams.participants[0].name, away: teams.participants[1].name, homeScore: score.home, awayScore: score.away }, { home: parseScore(raw.intHomeScoreExtra), away: parseScore(raw.intAwayScoreExtra) })
    : null
  return { ...shared, ...teams, status, score, ...(clock ? { clock } : {}), ...finish(raw, sportId), ...(breakdown ? { breakdown } : {}), ...(sportId === "football" ? { details: footballDetails(raw) } : sportId === "basketball" ? { details: basketballDetails(raw) } : sportId === "american-football" ? { details: americanFootballDetails(raw) } : sportId === "rugby" ? { details: rugbyDetails(raw) } : sportId === "volleyball" ? { details: volleyballDetails(raw, status === "finished"), ...(isDateOnly(raw) ? { dateOnly: true } : {}) } : {}) }
}
