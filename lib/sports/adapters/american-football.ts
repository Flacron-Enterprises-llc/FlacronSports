// American football: quarters and overtime. The field inventory lists three result
// formats: headed pairs (NFL, college), a plain "Final - 2OT" (Canadian university), and
// a "Score by Quarters" block (European Football Alliance) that names sides in its own order.

import type { EventConclusion, ScoreBreakdown, ScoreSegment } from "../types"
import { checked, headedPairs, numbered, type Phase, type Sides } from "./shared"

const HEADINGS = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4", "Overtime"]
const OVERTIME_INDEX = HEADINGS.length - 1

function headedQuarters(text: string, sides: Sides): ScoreBreakdown | null {
  const pairs = headedPairs(text, HEADINGS, sides)
  if (!pairs || pairs.slice(0, OVERTIME_INDEX).some((pair) => !pair)) return null
  const segments = pairs.flatMap((pair, index): ScoreSegment[] => {
    if (!pair) return []
    const overtime = index === OVERTIME_INDEX
    return [{ kind: overtime ? "overtime" : "quarter", number: overtime ? 1 : index + 1, home: pair[0], away: pair[1] }]
  })
  return checked(segments, sides)
}

const QUARTER_LINE = /^(Q\d|OT\d?):\s+(.+?)\s+(\d+)\s*-\s*(.+?)\s+(\d+)\s*$/

/** "Q1: Paris Musketeers 10 - Raiders Tirol 0", either side first. */
function namedQuarters(text: string, sides: Sides): ScoreBreakdown | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const segments = lines.flatMap((line): ScoreSegment[] => {
    const match = line.match(QUARTER_LINE)
    if (!match) return []
    const [, label, firstName, firstScore, secondName, secondScore] = match
    const named = [firstName, secondName]
    if (!named.includes(sides.home) || !named.includes(sides.away)) return []
    const home = Number(firstName === sides.home ? firstScore : secondScore)
    const away = Number(firstName === sides.home ? secondScore : firstScore)
    const quarter = label.match(/^Q(\d)$/)
    return [{ kind: quarter ? "quarter" : "overtime", number: quarter ? Number(quarter[1]) : Number(label.slice(2)) || 1, home, away }]
  })
  return segments.filter((item) => item.kind === "quarter").length === 4 ? checked(segments, sides) : null
}

export function americanFootballBreakdown(text: string, sides: Sides): ScoreBreakdown | null {
  return /^\s*Score by Quarters/i.test(text) ? namedQuarters(text, sides) : headedQuarters(text, sides)
}

/** Some leagues mark overtime only in the result text, under a plain final status. */
export function americanFootballConclusion(text: string | null | undefined): EventConclusion | null {
  return /^Final\s*-\s*\d*OT$/i.test((text ?? "").trim()) ? "overtime" : null
}

export function americanFootballPhase(code: string): Phase | null {
  if (code === "HT") return { key: "half-time" }
  if (code === "OT") return { key: "overtime" }
  return numbered(code, /^Q([1-4])$/, "quarter")
}
