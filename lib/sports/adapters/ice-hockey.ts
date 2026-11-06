// Ice hockey. The result text is never filled for this sport (field inventory: 6,554
// games), so a game's periods can only come from its timeline. Only NHL games have one:
// goals and penalties, each with a period code and the minute within that period.

import type { EventConclusion, EventScore, ScoreBreakdown, ScoreSegment } from "../types"
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

export type GoalSituation = "power-play" | "shorthanded"

export function goalSituation(detail: string | null | undefined): GoalSituation | null {
  const text = (detail ?? "").trim().toLowerCase()
  return text === "power-play" ? "power-play" : text === "shorthanded" ? "shorthanded" : null
}

const INFRACTIONS = new Set(["cross-checking", "hooking", "holding", "tripping", "high sticking", "fighting", "interference", "slashing", "roughing", "boarding", "elbowing", "charging", "delay of game", "too many men", "unsportsmanlike conduct"])

/** The infraction's dictionary key, or null for wording the French dictionary has no term for. */
export const infractionKey = (detail: string | null | undefined): string | null => {
  const text = (detail ?? "").trim().toLowerCase()
  return INFRACTIONS.has(text) ? text : null
}

export function hockeyPhase(code: string): Phase | null {
  if (code === "BT") return { key: "break" }
  if (code === "OT") return { key: "overtime" }
  if (code === "PT") return { key: "shootout" }
  return numbered(code, /^P([1-3])$/, "period")
}
