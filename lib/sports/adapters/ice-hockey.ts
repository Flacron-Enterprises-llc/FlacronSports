// Ice hockey. The result text is never filled for this sport (field inventory: 6,554
// games), so a game's periods can only come from its timeline. Only NHL games have one:
// goals and penalties, each with a period code and the minute within that period.

import type { RawEvent } from "../thesportsdb"
import type { EventConclusion, EventScore, ScoreBreakdown, ScoreSegment, SportEvent } from "../types"
import { numbered, type Phase } from "./shared"

export interface HockeyTimelineRow {
  strTimeline?: string | null
  strHome?: string | null
  strPeriod?: string | null
}

const PERIOD_ORDER = ["P1", "P2", "P3", "POT"]

/** Ordered within a game: the minute restarts each period, so it cannot sort a game by itself. */
export function periodRank(code: string | null | undefined): number {
  const at = PERIOD_ORDER.indexOf((code ?? "").trim().toUpperCase())
  return at === -1 ? PERIOD_ORDER.length : at
}

function segmentOf(code: string): Pick<ScoreSegment, "kind" | "number"> | null {
  if (code === "POT") return { kind: "overtime", number: 1 }
  const period = code.match(/^P([1-3])$/)
  return period ? { kind: "period", number: Number(period[1]) } : null
}

/**
 * Goals counted by period. The count stands only if it reaches the final score, which
 * proves no goal is missing, so a period with none is a true zero and not a gap. A
 * shootout has no timeline rows and adds one to the winner's final score, so there the
 * sides stand level and the score is exactly one apart. Overtime was then played and scoreless.
 */
export function hockeyPeriods(rows: HockeyTimelineRow[] | null | undefined, score: EventScore, conclusion?: EventConclusion): ScoreBreakdown | null {
  if (score.kind !== "team" || !rows?.length) return null
  const goals = rows.filter((row) => (row.strTimeline ?? "").trim().toLowerCase() === "goal")
  const count = (code: string, side: "Yes" | "No") => goals.filter((row) => (row.strPeriod ?? "").trim().toUpperCase() === code && row.strHome === side).length
  if (goals.some((row) => !segmentOf((row.strPeriod ?? "").trim().toUpperCase()))) return null
  const segments = PERIOD_ORDER.flatMap((code): ScoreSegment[] => {
    const place = segmentOf(code) as Pick<ScoreSegment, "kind" | "number">
    const [home, away] = [count(code, "Yes"), count(code, "No")]
    return place.kind === "overtime" && home + away === 0 && conclusion !== "shootout" ? [] : [{ ...place, home, away }]
  })
  const total = (side: "home" | "away") => segments.reduce((sum, item) => sum + (item[side] ?? 0), 0)
  const [home, away] = [total("home"), total("away")]
  const reached = conclusion === "shootout" ? home === away && Math.max(score.home, score.away) === home + 1 && Math.min(score.home, score.away) === home : home === score.home && away === score.away
  return reached ? { segments } : null
}

/**
 * The provider fills a game's rows late and sometimes only in part: of 55 NHL games checked,
 * 42 had none and 6 fell short of the final score. A shootout's winning goal is never a row.
 */
export function hockeyTimelineShort(rows: HockeyTimelineRow[] | null | undefined, score: EventScore, conclusion?: EventConclusion): boolean {
  if (score.kind !== "team" || !rows?.length) return false
  const goals = rows.filter((row) => (row.strTimeline ?? "").trim().toLowerCase() === "goal").length
  return goals < score.home + score.away - (conclusion === "shootout" ? 1 : 0)
}

export type GoalSituation = "power-play" | "shorthanded" | "empty-net"

const SITUATIONS: Record<string, GoalSituation> = { "power-play": "power-play", shorthanded: "shorthanded", "empty net": "empty-net" }

export function goalSituation(detail: string | null | undefined): GoalSituation | null {
  return SITUATIONS[(detail ?? "").trim().toLowerCase()] ?? null
}

const INFRACTIONS = new Set(["cross-checking", "hooking", "holding", "tripping", "high sticking", "fighting", "interference", "slashing", "roughing", "boarding", "elbowing", "charging", "delay of game", "too many men", "unsportsmanlike conduct", "holding the stick", "instigator penalty", "diving"])

/** The infraction's dictionary key, or null for wording the French dictionary has no term for. */
export const infractionKey = (detail: string | null | undefined): string | null => {
  const text = (detail ?? "").trim().toLowerCase()
  return INFRACTIONS.has(text) ? text : null
}

export function hockeyPhase(code: string): Phase | null {
  if (code === "BT") return { key: "break" }
  if (code === "OT" || /^P[4-9]$/.test(code)) return { key: "overtime" }
  if (code === "PT" || code === "P" || code === "SO") return { key: "shootout" }
  return numbered(code, /^P([1-3])$/, "period")
}

const SCHEDULE_HORIZON_MS = 30 * 86_400_000

/**
 * The source marks the end of a season "CANC" before its times are set: every NHL game from
 * 2 April 2027 and every AHL game from 5 April 2027 read so in November 2026, while the NHL
 * schedule lists them. A cancellation that far ahead is not one.
 */
export function hockeyCancelUnconfirmed(startUTC: string | null, now: Date): boolean {
  return startUTC !== null && Date.parse(startUTC) - now.getTime() > SCHEDULE_HORIZON_MS
}

/** Only NHL games have goal and penalty rows, so only they are worth a lookup for a card. */
const TIMELINE_LEAGUES = new Set(["4380"])

export function hockeyCardTimeline(event: Pick<SportEvent, "sportId" | "status" | "competition" | "score">): boolean {
  return event.sportId === "ice-hockey" && event.status === "finished" && event.score.kind === "team" && TIMELINE_LEAGUES.has(event.competition.id ?? "")
}

const spaced = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim()

/**
 * Some rows title a game "away vs home", and then the scores follow the title, not the team
 * fields: Detroit beat Buffalo 3-2 in overtime on 24 September 2026 (2591468) and Tampa Bay
 * beat Florida 3-2 on 30 September 2025 (2286691), yet both rows give the home field's side 3.
 * As in basketball the team fields stay and the scores turn, so the winner is right.
 */
export function hockeyRow(raw: RawEvent): RawEvent {
  const [home, away] = [spaced(raw.strHomeTeam), spaced(raw.strAwayTeam)]
  const reversed = Boolean(home && away) && home !== away && spaced(raw.strEvent) === `${away} vs ${home}`
  return reversed && !raw.fromLive ? { ...raw, intHomeScore: raw.intAwayScore, intAwayScore: raw.intHomeScore } : raw
}

const NO_CLOCK = new Set(["BT", "PT", "P", "SO"])

/** Nothing runs in an intermission or a shootout, whatever minute the feed still sends. */
export function hockeyClock(status: string | null | undefined, progress: string | null | undefined): string | null {
  return progress && !NO_CLOCK.has((status ?? "").trim().toUpperCase()) ? progress : null
}

/** Won, lost, then lost after regulation, the order every hockey table reads in. */
export const hockeyRecord = (won: number, lost: number, overtimeLosses: number) => `${won}-${lost}-${overtimeLosses}`
