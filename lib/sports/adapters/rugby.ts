// Rugby: halves, overtime, and tries where the feed states them. The field inventory has
// the one result format, often left blank, and no timeline, statistics or lineups.

import type { ScoreBreakdown, ScoreSegment } from "../types"
import { checked, headedPairs, type Phase, type Sides } from "./shared"

const HEADINGS = ["First Half", "Second Half", "Overtime"]
const OVERTIME_INDEX = HEADINGS.length - 1
// The fewest points a try can be worth in either code is four, so a count above that cannot be tries.
const POINTS_PER_TRY = 4

function halves(text: string, sides: Sides): ScoreSegment[] | null {
  const pairs = headedPairs(text, HEADINGS, sides)
  if (!pairs || pairs.slice(0, OVERTIME_INDEX).some((pair) => !pair)) return null
  return pairs.flatMap((pair, index): ScoreSegment[] => {
    if (!pair) return []
    const overtime = index === OVERTIME_INDEX
    return [{ kind: overtime ? "overtime" : "half", number: overtime ? 1 : index + 1, home: pair[0], away: pair[1] }]
  })
}

export function rugbyTries(homeExtra: number | null, awayExtra: number | null, sides: Sides): { home: number; away: number } | null {
  if (homeExtra === null || awayExtra === null) return null
  return homeExtra * POINTS_PER_TRY > sides.homeScore || awayExtra * POINTS_PER_TRY > sides.awayScore ? null : { home: homeExtra, away: awayExtra }
}

/** Tries can be known when the halves are not, so a game can have either or both. */
export function rugbyBreakdown(text: string | null | undefined, sides: Sides, tries: { home: number; away: number } | null): ScoreBreakdown | null {
  const segments = text ? halves(text, sides) : null
  const parsed = segments ? checked(segments, sides) : null
  if (!parsed && !tries) return null
  return { segments: parsed?.segments ?? [], ...(tries ? { tries } : {}) }
}

const PHASES: Record<string, Phase> = {
  "1H": { key: "first-half" },
  "2H": { key: "second-half" },
  HT: { key: "half-time" },
  ET: { key: "extra-time" },
  BT: { key: "extra-break" },
  PT: { key: "shootout" },
}

export const rugbyPhase = (code: string): Phase | null => PHASES[code] ?? null
