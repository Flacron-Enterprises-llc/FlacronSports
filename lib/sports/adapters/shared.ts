// What the team-sport adapters share: reading the feed's text. The logic for each
// sport stays in its own file, so this holds no sport's rules.

import type { PeriodKey } from "../thesportsdb"
import type { ScoreBreakdown, ScoreSegment } from "../types"

/** The running part of a live game, in a form the page can translate. */
export interface Phase {
  key: PeriodKey
  number?: number
}

export const numbered = (code: string, pattern: RegExp, key: PeriodKey): Phase | null => {
  const found = code.match(pattern)
  return found ? { key, number: Number(found[1]) } : null
}

export interface Sides {
  home: string
  away: string
  homeScore: number
  awayScore: number
}

export const rowsOf = (text: string) => text.split(/<br\s*\/?>/i).map((row) => row.trim())

/** Null for a row that is blank or holds anything but whole numbers. */
export const numbers = (row: string | undefined) => (/^\d+(?:\s+\d+)*$/.test(row ?? "") ? (row as string).split(/\s+/).map(Number) : null)

export const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0)

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

export interface SideBlock {
  name: string
  values: number[]
  /** The line under the values, for the sports that add one. */
  extra: string | undefined
}

/**
 * "Name Quarters:" then one row of numbers, once per side. The feed sometimes lists the
 * away side first and sometimes spells a side differently from the event, so a block is
 * placed by name when one matches, and in listed order otherwise.
 */
export function sideBlocks(text: string, heading: string, { home, away }: Sides): { home: SideBlock; away: SideBlock } | null {
  const rows = rowsOf(text)
  const suffix = ` ${heading}:`
  const blocks = rows.flatMap((row, index): SideBlock[] => {
    if (!row.endsWith(suffix)) return []
    const values = numbers(rows[index + 1])
    return values ? [{ name: row.slice(0, -suffix.length).trim(), values, extra: rows[index + 2] }] : []
  })
  if (blocks.length !== 2) return null
  const [first, second] = blocks
  const swapped = fold(first.name) === fold(away) || fold(second.name) === fold(home)
  return swapped ? { home: second, away: first } : { home: first, away: second }
}

/**
 * "Name First:" then "home away" under each heading, spelled exactly as the source spells
 * it. A heading with nothing under it has no score. The feed sometimes opens with the away
 * side, and then the pairs read away first too.
 */
export function headedPairs(text: string, headings: string[], { away }: Sides): ([number, number] | null)[] | null {
  const rows = rowsOf(text)
  const opening = `${headings[0]}:`
  if (!rows[0]?.endsWith(` ${opening}`)) return null
  const flipped = fold(rows[0].slice(0, -opening.length)) === fold(away)
  return headings.map((heading, index) => {
    const at = index === 0 ? 0 : rows.findIndex((row) => row.replace(/:$/, "") === heading)
    const values = at === -1 ? null : numbers(rows[at + 1])
    if (values?.length !== 2) return null
    return flipped ? [values[1], values[0]] : [values[0], values[1]]
  })
}

/** The parts must add up to the score, so a row the source left half written hides rather than misleads. */
export function addsUp(segments: ScoreSegment[], { homeScore, awayScore }: Sides): boolean {
  return sum(segments.map((item) => item.home)) === homeScore && sum(segments.map((item) => item.away)) === awayScore
}

export const checked = (segments: ScoreSegment[], sides: Sides): ScoreBreakdown | null => (addsUp(segments, sides) ? { segments } : null)
