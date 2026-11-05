import type { EventScore, EventStatus, SportEvent, SportId } from "./types"

export const PROVIDER_NAME = "TheSportsDB"

export interface RawEvent {
  idEvent: string
  idLeague?: string | null
  strLeague?: string | null
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

function toUtc(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(timestamp)
  const date = new Date(hasZone ? timestamp : `${timestamp}Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizeEvent(raw: RawEvent, sportId: SportId): SportEvent {
  const status = normalizeStatus(raw)
  return {
    id: `tsdb-${raw.idEvent}`,
    sportId,
    eventType: "match",
    participantType: "team",
    participants: [
      { id: raw.idHomeTeam ?? null, name: raw.strHomeTeam || "TBD", role: "home", badgeUrl: raw.strHomeTeamBadge ?? null },
      { id: raw.idAwayTeam ?? null, name: raw.strAwayTeam || "TBD", role: "away", badgeUrl: raw.strAwayTeamBadge ?? null },
    ],
    competition: { id: raw.idLeague ?? null, name: raw.strLeague || "Unknown competition", country: raw.strCountry ?? null },
    scheduledStartUTC: toUtc(raw.strTimestamp),
    status,
    providerStatus: raw.strStatus ?? null,
    score: normalizeScore(raw, status),
    venue: raw.strVenue || null,
    provider: { name: PROVIDER_NAME, eventId: raw.idEvent },
    sourceUpdatedAt: null,
    coverageFlags: { liveScores: false, statistics: false, video: false },
  }
}
