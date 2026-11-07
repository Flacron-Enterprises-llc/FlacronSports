// Volleyball: sets. The final score counts sets won and the points are in strResult. The
// field inventory shows the feed never fills its fourth heading, which it spells "Forth",
// so a four or five set game has a real gap there. It stays empty rather than being guessed.

import type { ScoreBreakdown, ScoreSegment } from "../types"
import { headedPairs, numbered, type Phase, type Sides } from "./shared"

const HEADINGS = ["First", "Second", "Third", "Forth", "Fifth"]
const FEWEST_SETS = 3

export function volleyballBreakdown(text: string, sides: Sides): ScoreBreakdown | null {
  const pairs = headedPairs(text, HEADINGS, sides)
  if (!pairs) return null
  const last = pairs.reduce((found, pair, index) => (pair ? index : found), -1)
  if (last < FEWEST_SETS - 1) return null
  // Sets played come from the final score, so a set the feed left empty shows as a gap and is not dropped.
  const played = Math.min(sides.homeScore + sides.awayScore, HEADINGS.length)
  const segments = Array.from({ length: Math.max(last + 1, played) }, (_, index): ScoreSegment => ({ kind: "set", number: index + 1, home: pairs[index]?.[0] ?? null, away: pairs[index]?.[1] ?? null }))
  const won = (side: "home" | "away", other: "home" | "away") => segments.filter((item) => (item[side] ?? 0) > (item[other] ?? 0)).length
  return won("home", "away") <= sides.homeScore && won("away", "home") <= sides.awayScore ? { segments } : null
}

export const volleyballPhase = (code: string): Phase | null => numbered(code, /^S([1-5])$/, "set")
