// American football: quarters and overtime. The field inventory lists three result
// formats: headed pairs (NFL, college), a plain "Final - 2OT" (Canadian university), and
// a "Score by Quarters" block (European Football Alliance) that names sides in its own order.

import type { RawEvent } from "../thesportsdb"
import type { AmericanFootballDetails, EventConclusion, ScoreBreakdown, ScoreSegment } from "../types"
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

const spaced = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim()

/**
 * Some college rows title a game "away vs home" and file it under that same name, and then the
 * two scores follow the title, not the team fields: Alabama State beat Southern 30-17 (2593834)
 * and Elon beat Davidson 38-0 (2331675), both stored the other way round. A row titled away first
 * but filed "home vs away" keeps its scores in team order, as Alabama's 20-9 over LSU (2294830) shows.
 * Seen on 636 of 4,847 rows, all college. A live row is left alone: nothing shows how the live feed orders it.
 */
export function americanFootballRow(raw: RawEvent): RawEvent {
  const [home, away] = [spaced(raw.strHomeTeam), spaced(raw.strAwayTeam)]
  const awayFirst = `${away} vs ${home}`
  const reversed = Boolean(home && away) && home !== away && spaced(raw.strEvent) === awayFirst && spaced(raw.strFilename).endsWith(awayFirst)
  const live = /^(?:Q[1-4]|HT|OT)$/i.test((raw.strStatus ?? "").trim())
  return reversed && !live && !raw.fromLive ? { ...raw, intHomeScore: raw.intAwayScore, intAwayScore: raw.intHomeScore } : raw
}

type Stage = NonNullable<AmericanFootballDetails["stage"]>

// Round codes above the weeks, per league, read from full seasons 2025 and 2026. The source's
// own scheme is 125 quarter-final, 150 semi-final, 160 playoff, 200 final, 500 preseason, but each
// league files its playoffs its own way: the NFL's 125 is the divisional round, not a quarter-final.
const LEAGUE_STAGES: Record<string, Record<number, Stage>> = {
  NFL: { 160: "wild-card", 125: "divisional", 150: "conference-final", 200: "super-bowl" },
  CFL: { 160: "division-semi-final", 150: "division-final", 200: "grey-cup" },
  // Bowls, the playoff and the FCS playoffs all share 160. 180 held the FCS title game, 200 the national final.
  "NCAA Division 1 Football": { 160: "postseason", 180: "fcs-final", 200: "national-final" },
  "NCAA Division 1": { 160: "postseason", 180: "fcs-final", 200: "national-final" },
  // 150 in 2025 and 160 in 2026 were the same two conference championship games.
  UFL: { 150: "conference-final", 160: "conference-final", 200: "final" },
  // Ontario quarter-finals 170, conference semi-finals 180, conference finals 125, national semi-finals 150, Vanier Cup 200.
  "U Sports Football League": { 170: "playoff", 180: "playoff", 125: "conference-final", 150: "semi-final", 200: "final" },
}
const STAGES: Record<number, Stage> = { 125: "quarter-final", 150: "semi-final", 160: "playoff", 170: "playoff", 180: "playoff", 200: "final" }
const PRESEASON = 500
const MOST_WEEKS = 30

const clean = (text: string | null | undefined) => text?.trim() || null

export function americanFootballDetails(raw: RawEvent): AmericanFootballDetails {
  const round = Number(raw.intRound)
  const spectators = Number(raw.intSpectators)
  const league = spaced(raw.strLeague)
  return {
    kind: "american-football",
    week: Number.isInteger(round) && round > 0 && round <= MOST_WEEKS ? round : null,
    stage: round === PRESEASON ? "preseason" : ((LEAGUE_STAGES[league] ?? STAGES)[round] ?? null),
    season: clean(raw.strSeason),
    city: clean(raw.strCity),
    country: clean(raw.strCountry),
    spectators: Number.isInteger(spectators) && spectators > 0 ? spectators : null,
  }
}
