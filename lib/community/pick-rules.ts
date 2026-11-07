// What a pick may be in each sport. Free of server code, so the form and the API read
// the same limits.

import type { SportId } from "@/lib/sports/types"

// Winner and podium values can never add up to `exact`: settlement counts exact
// scores by comparing against it, so podium points stay even and winner stays 3.
export const POINTS = { exact: 5, outcome: 2, winner: 3, podiumExact: 4, podiumPlaced: 2 } as const
export const PODIUM_SIZE = 3
export const PERFECT_PODIUM = PODIUM_SIZE * POINTS.podiumExact

export type ScoreUnit = "goals" | "points" | "runs" | "sets"

export interface ScoreRule {
  max: number
  unit: ScoreUnit
  canEndLevel: boolean
}

/** Sports picked by final score. The rest are picked by winner or podium. */
export const SCORE_RULES: Partial<Record<SportId, ScoreRule>> = {
  football: { max: 30, unit: "goals", canEndLevel: true },
  "ice-hockey": { max: 30, unit: "goals", canEndLevel: true },
  rugby: { max: 150, unit: "points", canEndLevel: true },
  "american-football": { max: 100, unit: "points", canEndLevel: false },
  baseball: { max: 50, unit: "runs", canEndLevel: false },
  volleyball: { max: 3, unit: "sets", canEndLevel: false },
}

/** Every sport that takes a pick, for the leaderboard's filter. */
export const PREDICTION_SPORTS: SportId[] = ["football", "basketball", "american-football", "baseball", "ice-hockey", "rugby", "volleyball", "tennis", "cricket", "combat-sports", "motorsport"]
