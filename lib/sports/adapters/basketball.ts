// Basketball: quarters, or halves in men's college games, and overtime. Formats seen
// across 10,280 games are in the field inventory. The score breakdown lives in strResult,
// which day, past-league and single-game reads carry and the season read leaves out.

import type { ScoreBreakdown, ScoreSegment } from "../types"
import { checked, numbered, sideBlocks, type Phase, type Sides } from "./shared"

const REGULAR_QUARTERS = 4

function quarterSegments(home: number[], away: number[]): ScoreSegment[] {
  return home.map((value, index) => ({
    kind: index < REGULAR_QUARTERS ? "quarter" : "overtime",
    number: index < REGULAR_QUARTERS ? index + 1 : index - REGULAR_QUARTERS + 1,
    home: value,
    away: away[index],
  }))
}

/** Men's college games play two halves, written in the second and fourth slots with zeros around them. */
function halfSegments(home: number[], away: number[]): ScoreSegment[] {
  const overtime = home.slice(REGULAR_QUARTERS).map((value, index): ScoreSegment => ({ kind: "overtime", number: index + 1, home: value, away: away[index + REGULAR_QUARTERS] }))
  return [{ kind: "half", number: 1, home: home[1], away: away[1] }, { kind: "half", number: 2, home: home[3], away: away[3] }, ...overtime]
}

const writtenAsHalves = (home: number[], away: number[]) => [home, away].every((side) => side[0] === 0 && side[2] === 0)

export function basketballBreakdown(text: string, sides: Sides): ScoreBreakdown | null {
  const blocks = sideBlocks(text, "Quarters", sides)
  if (!blocks) return null
  const [home, away] = [blocks.home.values, blocks.away.values]
  if (home.length !== away.length || home.length < REGULAR_QUARTERS) return null
  const segments = writtenAsHalves(home, away) ? halfSegments(home, away) : quarterSegments(home, away)
  // A real game has no scoreless quarter for both sides. The feed writes one when it stopped updating.
  if (segments.some((item) => item.kind === "quarter" && item.home === 0 && item.away === 0)) return null
  return checked(segments, sides)
}

export const BASKETBALL_PERCENT_STATS = ["2-points %", "3-points %", "free throws %"]

export type BasketballRole = "PG" | "SG" | "SF" | "PF" | "C" | "G" | "F"

const ROLES: Record<string, BasketballRole> = { "point guard": "PG", "shooting guard": "SG", "small forward": "SF", "power forward": "PF", center: "C", guard: "G", forward: "F" }

export const basketballRole = (position: string | null | undefined): BasketballRole | null => ROLES[(position ?? "").trim().toLowerCase()] ?? null

const MENS_COLLEGE = /\bNCAA\b.*\bMens\b/i

/** Men's college games are live as "Q1" then "Q2", which there means the two halves. */
export function basketballPhase(code: string, league?: string | null): Phase | null {
  if (MENS_COLLEGE.test(league ?? "") && (code === "Q1" || code === "Q2")) return { key: code === "Q1" ? "first-half" : "second-half" }
  if (code === "HT") return { key: "half-time" }
  if (code === "BT") return { key: "break" }
  if (code === "OT") return { key: "overtime" }
  return numbered(code, /^Q([1-4])$/, "quarter")
}
