// Strict readers for the free-form result field. Each one returns null unless the
// whole text fits the expected shape, so a format change hides a result rather than
// showing a wrong one. Provider prose is never kept: it can name other publishers,
// and one sampled card contradicted itself, so only checked facts leave this file.

import type { Sides } from "./adapters/shared"
import { teamBreakdown } from "./adapters/team"
import type { ScoreBreakdown, SportId } from "./types"

export function parseBreakdown(text: string | null | undefined, sport: SportId, sides: Sides): ScoreBreakdown | null {
  return teamBreakdown(text, sport, sides)
}
