// Basketball: quarters, or halves in men's college games, and overtime. Formats seen
// across 10,280 games are in the field inventory. The score breakdown lives in strResult,
// which day, past-league and single-game reads carry and the season read leaves out.

import type { RawEvent } from "../thesportsdb"
import type { BasketballDetails, ScoreBreakdown, ScoreSegment } from "../types"
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

/** A few rows separate the quarters with commas: "20, 27, 16, 15". */
const plainRows = (text: string) => text.replace(/(\d)\s*,\s*(?=\d)/g, "$1 ")

export function basketballBreakdown(text: string, sides: Sides): ScoreBreakdown | null {
  const blocks = sideBlocks(plainRows(text), "Quarters", sides)
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

const TIMED_PERIOD = /^Q[1-4]$/
const LONGEST_QUARTER = 12

/**
 * The feed counts minutes played in the quarter, 1 up to 10 or 12. It sends 0 through every
 * break, and in overtime values from 6 to 10 in a five-minute period, so those say nothing.
 */
export function basketballClock(status: string | null | undefined, progress: string | null | undefined): string | null {
  const minute = Number(progress)
  return TIMED_PERIOD.test((status ?? "").trim().toUpperCase()) && Number.isInteger(minute) && minute > 0 && minute <= LONGEST_QUARTER ? String(minute) : null
}

const spaced = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim()

/** A stored or live row with its own contradictions settled, before anything reads it. */
export function basketballRow(raw: RawEvent): RawEvent {
  const [home, away] = [spaced(raw.strHomeTeam), spaced(raw.strAwayTeam)]
  // Some rows title a game "away vs home", and then the two scores follow the title, not the
  // team fields: quarters prove it on every such row, and Detroit's 122-110 over Dallas in
  // Mexico City (2292739) reads that way. The team fields are right: the venue is the home side's.
  const reversed = Boolean(home && away) && home !== away && spaced(raw.strEvent) === `${away} vs ${home}`
  // The flag stays set on a game the status has since settled.
  const open = !/^(?:FT|AOT|CANC)$/i.test((raw.strStatus ?? "").trim())
  return {
    ...raw,
    ...(reversed && !raw.fromLive ? { intHomeScore: raw.intAwayScore, intAwayScore: raw.intHomeScore } : {}),
    ...(open ? {} : { strPostponed: "no" }),
    strProgress: basketballClock(raw.strStatus, raw.strProgress),
  }
}

// Round codes above the numbered rounds, as filed in full seasons. Each league uses its own.
const PRESEASON = 500
const STAGES: Record<number, BasketballDetails["stage"]> = { 125: "quarter", 150: "semi", 200: "final" }
const LEAGUE_STAGES: Record<string, Record<number, BasketballDetails["stage"]>> = {
  NBA: { 160: "first-round", 200: "final", 400: "play-in" },
  WNBA: { 160: "first-round", 200: "final" },
  "EuroLeague Basketball": { ...STAGES, 170: "play-in", 180: "play-in" },
}
// These two number the weeks of a season, which is no round a fan would name.
const WEEK_NUMBERED = new Set(["NBA", "WNBA"])
const MOST_ROUNDS = 60

const clean = (text: string | null | undefined) => text?.trim() || null

export function basketballDetails(raw: RawEvent): BasketballDetails {
  const league = raw.strLeague ?? ""
  const round = Number(raw.intRound)
  const spectators = Number(raw.intSpectators)
  return {
    kind: "basketball",
    round: Number.isInteger(round) && round > 0 && round <= MOST_ROUNDS && !WEEK_NUMBERED.has(league) ? round : null,
    stage: round === PRESEASON ? "preseason" : ((LEAGUE_STAGES[league] ?? STAGES)[round] ?? null),
    group: clean(raw.strGroup),
    season: clean(raw.strSeason),
    city: clean(raw.strCity),
    country: clean(raw.strCountry),
    spectators: Number.isInteger(spectators) && spectators > 0 ? spectators : null,
  }
}
