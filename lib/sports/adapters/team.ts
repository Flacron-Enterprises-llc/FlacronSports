// Which sport's rules read a team game. Football has no result text to read, and the
// individual sports have their own adapters.

import type { ScoreBreakdown, SportId } from "../types"
import { americanFootballBreakdown, americanFootballPhase } from "./american-football"
import { baseballBreakdown, baseballPhase } from "./baseball"
import { basketballBreakdown, basketballPhase } from "./basketball"
import { hockeyPhase } from "./ice-hockey"
import { rugbyBreakdown, rugbyPhase, rugbyTries } from "./rugby"
import type { Phase, Sides } from "./shared"
import { volleyballBreakdown, volleyballPhase } from "./volleyball"

export interface ExtraScores {
  home: number | null
  away: number | null
}

export function teamBreakdown(text: string | null | undefined, sport: SportId, sides: Sides, extra: ExtraScores = { home: null, away: null }): ScoreBreakdown | null {
  if (sport === "rugby") return rugbyBreakdown(text, sides, rugbyTries(extra.home, extra.away, sides))
  if (!text) return null
  if (sport === "basketball") return basketballBreakdown(text, sides)
  if (sport === "baseball") return baseballBreakdown(text, sides)
  if (sport === "american-football") return americanFootballBreakdown(text, sides)
  return sport === "volleyball" ? volleyballBreakdown(text, sides) : null
}

export function teamPhase(sport: SportId, code: string, league?: string | null): Phase | null {
  if (sport === "basketball") return basketballPhase(code, league)
  if (sport === "ice-hockey") return hockeyPhase(code)
  if (sport === "american-football") return americanFootballPhase(code)
  if (sport === "baseball") return baseballPhase(code)
  if (sport === "rugby") return rugbyPhase(code)
  return sport === "volleyball" ? volleyballPhase(code) : null
}
