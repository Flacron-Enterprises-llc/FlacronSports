// Baseball: a line score of innings, runs, hits and errors. Two formats are in the field
// inventory: "Name Innings:" blocks for most leagues and a tabbed R H E table for the World
// Baseball Classic.

import type { ScoreBreakdown, ScoreSegment } from "../types"
import { numbered, sideBlocks, sum, type Phase, type Sides } from "./shared"

const REGULAR_INNINGS = 9
const HITS_LINE = /^Hits: (\d+) - Errors: (\d+)$/

const pairOf = (home: number | undefined, away: number | undefined) => (home === undefined || away === undefined ? undefined : { home, away })

function withTotals(segments: ScoreSegment[], hits?: { home: number; away: number }, errors?: { home: number; away: number }): ScoreBreakdown {
  return { segments, ...(hits ? { hits } : {}), ...(errors ? { errors } : {}) }
}

/** A home side that did not bat in the last inning has no value there, not a zero. */
const innings = (home: number[], away: number[]): ScoreSegment[] =>
  Array.from({ length: Math.max(home.length, away.length) }, (_, index) => ({ kind: "inning" as const, number: index + 1, home: home[index] ?? null, away: away[index] ?? null }))

/**
 * After nine innings the feed has one more slot for all extra innings, and it writes the
 * same number there for both sides, so one of them is always wrong. The score settles
 * it: each side's extras are what its total still needs after nine.
 */
function extraInnings(home: number[], away: number[], { homeScore, awayScore }: Sides): ScoreSegment[] | null {
  const [homeNine, awayNine] = [home.slice(0, REGULAR_INNINGS), away.slice(0, REGULAR_INNINGS)]
  if (sum(homeNine) !== sum(awayNine)) return null
  const [homeExtra, awayExtra] = [homeScore - sum(homeNine), awayScore - sum(awayNine)]
  if (homeExtra < 0 || awayExtra < 0 || ![homeExtra, awayExtra].includes(home[REGULAR_INNINGS])) return null
  return [...innings(homeNine, awayNine), { kind: "extras", number: 1, home: homeExtra, away: awayExtra }]
}

function blockInnings(text: string, sides: Sides): ScoreBreakdown | null {
  const blocks = sideBlocks(text, "Innings", sides)
  if (!blocks) return null
  const [home, away] = [blocks.home.values, blocks.away.values]
  const extras = home.length > REGULAR_INNINGS && away.length === home.length
  const segments = extras ? extraInnings(home, away, sides) : sum(home) === sides.homeScore && sum(away) === sides.awayScore ? innings(home, away) : null
  if (!segments) return null
  const [homeLine, awayLine] = [blocks.home.extra?.match(HITS_LINE), blocks.away.extra?.match(HITS_LINE)]
  const hits = homeLine && awayLine ? { home: Number(homeLine[1]), away: Number(awayLine[1]) } : undefined
  const errors = homeLine && awayLine ? { home: Number(homeLine[2]), away: Number(awayLine[2]) } : undefined
  return withTotals(segments, hits, errors)
}

const tableCells = (row: string) => row.split("\t").map((cell) => cell.trim())

/** Header "1 2 ... R H E" then a row per side, opening with the side's name. */
function tabbedLineScore(text: string, sides: Sides): ScoreBreakdown | null {
  const rows = text.split(/\r?\n/).filter((row) => row.trim())
  const header = tableCells(rows[0] ?? "")
  const [runsAt, hitsAt, errorsAt] = [header.indexOf("R"), header.indexOf("H"), header.indexOf("E")]
  if (runsAt < 1 || hitsAt !== runsAt + 1 || errorsAt !== runsAt + 2 || rows.length < 3) return null
  const cells = rows.slice(1).map(tableCells).map((row) => row.slice(1).map((cell) => (/^\d+$/.test(cell) ? Number(cell) : null)))
  // This table names sides its own way ("United States" for "USA Baseball"), so the runs place them.
  const home = cells.find((row) => row.length === header.length && row[runsAt] === sides.homeScore)
  const away = cells.find((row) => row !== home && row.length === header.length && row[runsAt] === sides.awayScore)
  if (!home || !away || sides.homeScore === sides.awayScore) return null
  const inningsOnly = (row: (number | null)[]) => row.slice(0, runsAt).flatMap((value) => (value === null ? [] : [value]))
  return withTotals(innings(inningsOnly(home), inningsOnly(away)), pairOf(home[hitsAt] ?? undefined, away[hitsAt] ?? undefined), pairOf(home[errorsAt] ?? undefined, away[errorsAt] ?? undefined))
}

export function baseballBreakdown(text: string, sides: Sides): ScoreBreakdown | null {
  return text.includes("Innings:") ? blockInnings(text, sides) : tabbedLineScore(text, sides)
}

export const baseballPhase = (code: string): Phase | null => numbered(code, /^IN(\d{1,2})$/, "inning")
