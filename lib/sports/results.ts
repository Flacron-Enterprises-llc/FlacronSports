// Strict readers for the free-form result field. Each one returns null unless the
// whole text fits the expected shape, so a format change hides a result rather than
// showing a wrong one. Provider prose is never kept: it can name other publishers,
// and one sampled card contradicted itself, so only checked facts leave this file.

import type { ClassificationEntry, CombatMethod, EventScore, ScoreBreakdown, ScoreSegment, SetLine, SportId } from "./types"

type Sets = Extract<EventScore, { kind: "sets" }>
type Combat = Omit<Extract<EventScore, { kind: "combat" }>, "kind">

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
/** A card title may give only a surname; two full names must match outright. */
function sameFighter(a: string, b: string): boolean {
  const [x, y] = [fold(a), fold(b)]
  return x === y || x.endsWith(` ${y}`) || y.endsWith(` ${x}`)
}

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim())

export function parseTennisResult(text: string | null | undefined): Omit<Sets, "kind"> | null {
  if (!text) return null
  const rows = lines(text)
  const scored: SetLine[] = rows.flatMap((row) => {
    const match = row.match(/^(.+?)\s*:\s*(\d+(?:\s+\d+)*)$/)
    return match ? [{ name: match[1].trim(), games: match[2].split(/\s+/).map(Number) }] : []
  })
  if (scored.length !== 2 || scored[0].games.length !== scored[1].games.length) return null

  const names = scored.map((line) => line.name)
  const winner = rows[0].match(/^(.+?)\s+beat\s+.+?\s+\d+-\d+$/)?.[1].trim() ?? null
  const retired = rows[0].match(/^(.+?)\s+retired from the match\.?$/)?.[1].trim() ?? null
  if ((winner && !names.includes(winner)) || (retired && !names.includes(retired))) return null
  return { lines: scored, winner, retired }
}

/** Seeds such as "(21)" are dropped; the names are the source's own. */
export function parseTennisDraw(description: string | null | undefined): { tournament: string; names: [string, string] } | null {
  const [header, draw] = lines(description ?? "")
  const match = draw?.match(/^(.+?)(?:\s*\(\w+\))?\s+vs\.?\s+(.+?)(?:\s*\(\w+\))?$/)
  return match ? { tournament: header.split(" - ")[0].trim(), names: [match[1].trim(), match[2].trim()] } : null
}

/** "UFC 333 A vs B" names its card and headliners. A title with no number has no safe split. */
export function parseCard(title: string, isSingleBout: boolean): { card: string | null; names: [string, string] } | null {
  const carded = title.match(/^(.*\d)\s+(\S.*?)\s+vs\.?\s+(.+)$/)
  if (carded) return { card: carded[1].trim(), names: [carded[2].trim(), carded[3].trim()] }
  const single = isSingleBout ? title.match(/^(\D+?)\s+vs\.?\s+(\D+)$/) : null
  return single ? { card: null, names: [single[1].trim(), single[2].trim()] } : null
}

function combatMethod(text: string): CombatMethod | null {
  const value = text.toLowerCase()
  if (/unanimous/.test(value)) return "unanimous-decision"
  if (/split/.test(value)) return "split-decision"
  if (/majority/.test(value)) return "majority-decision"
  if (/decision/.test(value)) return "decision"
  if (/\btko\b|technical knockout/.test(value)) return "tko"
  if (/\bko\b|knockout/.test(value)) return "ko"
  if (/submission/.test(value)) return "submission"
  if (/disqualif/.test(value)) return "disqualification"
  return null
}

interface Bout {
  winner: string
  loser: string
  method: CombatMethod | null
  round: number | null
  time: string | null
}

const cleanName = (name: string) => name.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim()

function tableBouts(rows: string[]): Bout[] {
  return rows.flatMap((row) => {
    const cells = row.split("\t").map((cell) => cell.trim())
    const at = cells.indexOf("def.")
    if (at < 1) return []
    const round = Number(cells[at + 3])
    return [{
      winner: cleanName(cells[at - 1]),
      loser: cleanName(cells[at + 1]),
      method: combatMethod(cells[at + 2] ?? ""),
      round: Number.isInteger(round) && round > 0 ? round : null,
      time: /^\d+:\d{2}$/.test(cells[at + 4] ?? "") ? cells[at + 4] : null,
    }]
  })
}

function proseBout(rows: string[]): Bout | null {
  const first = rows.find((row) => row && !row.includes("\t"))
  const match = first?.match(/^(.+?)\s+(?:def\.|defeated|beat|dethroned|stopped|knocked out|outpointed)\s+(.+?)\s+by\s+(.+?)(?:[.,]|\s+in\s|\s+to\s|$)/)
  if (!match) return null
  return { winner: cleanName(match[1]), loser: cleanName(match[2]), method: combatMethod(match[3]), round: null, time: null }
}

/**
 * A result needs the winner and the loser to be the two named fighters. When the
 * prose and the bout table disagree, neither is believed.
 */
export function parseCombatResult(text: string | null | undefined, names: [string, string]): Combat | null {
  if (!text) return null
  const rows = lines(text)
  const concerns = (bout: Bout) =>
    (sameFighter(bout.winner, names[0]) && sameFighter(bout.loser, names[1])) ||
    (sameFighter(bout.winner, names[1]) && sameFighter(bout.loser, names[0]))

  const tabled = tableBouts(rows).find(concerns)
  const prose = proseBout(rows)
  const told = prose && concerns(prose) ? prose : null
  if (tabled && told && !sameFighter(tabled.winner, told.winner)) return null

  const bout = tabled ?? told
  if (!bout) return null
  const winner = sameFighter(bout.winner, names[0]) ? names[0] : names[1]
  return { winner, method: bout.method ?? told?.method ?? null, round: bout.round, time: bout.time }
}

const NATIONS = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "China", "Colombia", "Denmark", "Finland", "France",
  "Germany", "India", "Indonesia", "Italy", "Japan", "Mexico", "Monaco", "Netherlands", "New Zealand", "Poland", "Russia",
  "Spain", "Sweden", "Switzerland", "Thailand", "United Kingdom", "United States", "Venezuela",
]

const finishTime = (cell: string | undefined) => cell?.match(/^\+?\d[\d:.]*(?=[a-z]?$)/)?.[0] ?? null

function withoutNation(cell: string): string | null {
  const nation = NATIONS.find((name) => cell.startsWith(`${name} `))
  return nation ? cell.slice(nation.length + 1).trim() : null
}

/** Grand prix table: position, number, nation and driver, team, laps, time, grid, points. */
function grandPrixRow(row: string): ClassificationEntry | null {
  const cells = row.split("\t").map((cell) => cell.trim())
  if (!/^\d+$/.test(cells[1] ?? "") || !/^\d+$/.test(cells[4] ?? "")) return null
  const name = withoutNation(cells[2])
  if (!name || !cells[3]) return null
  return { position: Number(cells[0]), name, team: cells[3], time: finishTime(cells[5]), laps: Number(cells[4]), grid: /^\d+$/.test(cells[6] ?? "") ? Number(cells[6]) : null }
}

/** Slash-marked table: position, /rider, /team, /time. */
function slashRow(row: string): ClassificationEntry | null {
  const match = row.match(/^(\d+)\s+\/([^/\t]+?)\s*\t+\s*\/([^/\t]+?)\s*\t+\s*\/(\S+)\s*$/)
  return match ? { position: Number(match[1]), name: match[2].trim(), team: match[3].trim(), time: finishTime(match[4]) } : null
}

/**
 * Reads the classified finishers only. Retirements, the not-classified block and the
 * championship table that can follow are not part of it.
 */
export function parseClassification(text: string | null | undefined): ClassificationEntry[] | null {
  if (!text) return null
  const rows = text.split(/\r?\n/)
  const end = rows.findIndex((row) => !/^\d+\t/.test(row))
  const body = end === -1 ? rows : rows.slice(0, end)
  const reader = body[0]?.includes("/") ? slashRow : grandPrixRow
  const entries = body.map(reader)
  if (entries.length < 3 || entries.some((entry, index) => entry?.position !== index + 1)) return null
  return entries as ClassificationEntry[]
}

const numbers = (row: string | undefined) => (/^\d+(?:\s+\d+)*$/.test(row ?? "") ? (row as string).split(/\s+/).map(Number) : null)
const rowsOf = (text: string) => text.split(/<br\s*\/?>/i).map((row) => row.trim())
const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0)

interface Sides {
  home: string
  away: string
  homeScore: number
  awayScore: number
}

/** "Name Quarters:" then one row per side. Baseball adds a hits and errors line. */
function sideRows(text: string, heading: string, { home, away }: Sides) {
  const rows = rowsOf(text)
  const read = (name: string) => {
    const at = rows.indexOf(`${name} ${heading}:`)
    const values = at === -1 ? null : numbers(rows[at + 1])
    const totals = at === -1 ? null : rows[at + 2]?.match(/^Hits: (\d+) - Errors: (\d+)$/)
    return values ? { values, hits: totals ? Number(totals[1]) : null, errors: totals ? Number(totals[2]) : null } : null
  }
  const [first, second] = [read(home), read(away)]
  return first && second ? { first, second } : null
}

function quarters(text: string, sides: Sides): ScoreBreakdown | null {
  const parsed = sideRows(text, "Quarters", sides)
  if (!parsed) return null
  const { first, second } = parsed
  const played = first.values.length
  // Some college games are written as halves in the second and fourth slots, which would read as scoreless quarters.
  if (played !== second.values.length || played < 4 || first.values.some((value, index) => value === 0 && second.values[index] === 0)) return null
  if (sum(first.values) !== sides.homeScore || sum(second.values) !== sides.awayScore) return null
  return {
    segments: first.values.map((home, index) => ({
      kind: index < 4 ? "quarter" : "overtime",
      number: index < 4 ? index + 1 : index - 3,
      home,
      away: second.values[index],
    })),
  }
}

/** A home side that did not bat in the last inning has no value there, not a zero. */
function innings(text: string, sides: Sides): ScoreBreakdown | null {
  const parsed = sideRows(text, "Innings", sides)
  if (!parsed) return null
  const { first, second } = parsed
  if (sum(first.values) !== sides.homeScore || sum(second.values) !== sides.awayScore) return null
  const played = Math.max(first.values.length, second.values.length)
  const segments = Array.from({ length: played }, (_, index): ScoreSegment => ({ kind: "inning", number: index + 1, home: first.values[index] ?? null, away: second.values[index] ?? null }))
  const pair = (home: number | null, away: number | null) => (home === null || away === null ? {} : { home, away })
  const hits = pair(first.hits, second.hits)
  const errors = pair(first.errors, second.errors)
  return { segments, ...("home" in hits ? { hits: hits as { home: number; away: number } } : {}), ...("home" in errors ? { errors: errors as { home: number; away: number } } : {}) }
}

/** "Name First:" then "home away" under each heading. The source spells "Forth", and a blank heading has no score. */
function headedPairs(text: string, headings: string[], { home }: Sides): ([number, number] | null)[] | null {
  const rows = rowsOf(text)
  if (rows[0] !== `${home} ${headings[0]}:`) return null
  return headings.map((heading, index) => {
    const at = index === 0 ? 0 : rows.findIndex((row) => row.replace(/:$/, "") === heading)
    const values = at === -1 ? null : numbers(rows[at + 1])
    return values?.length === 2 ? [values[0], values[1]] : null
  })
}

const QUARTER_HEADINGS = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4", "Overtime"]
const HALF_HEADINGS = ["First Half", "Second Half", "Overtime"]
const SET_HEADINGS = ["First", "Second", "Third", "Forth", "Fifth"]

/** Regular periods must all be there and add up to the score, so a partial row hides rather than misleads. */
function regularPairs(text: string, headings: string[], kind: "quarter" | "half", sides: Sides): ScoreBreakdown | null {
  const pairs = headedPairs(text, headings, sides)
  if (!pairs || pairs.slice(0, -1).some((pair) => !pair)) return null
  const segments = pairs.flatMap((pair, index): ScoreSegment[] => {
    if (!pair) return []
    const overtime = index === headings.length - 1
    return [{ kind: overtime ? "overtime" : kind, number: overtime ? 1 : index + 1, home: pair[0], away: pair[1] }]
  })
  if (sum(segments.map((item) => item.home)) !== sides.homeScore || sum(segments.map((item) => item.away)) !== sides.awayScore) return null
  return { segments }
}

/** The total counts sets won. A set the source left blank keeps its place, empty. */
function volleyballSets(text: string, sides: Sides): ScoreBreakdown | null {
  const pairs = headedPairs(text, SET_HEADINGS, sides)
  if (!pairs) return null
  const last = pairs.reduce((found, pair, index) => (pair ? index : found), -1)
  if (last < 2) return null
  const segments = pairs.slice(0, last + 1).map((pair, index): ScoreSegment => ({ kind: "set", number: index + 1, home: pair?.[0] ?? null, away: pair?.[1] ?? null }))
  const won = (side: "home" | "away", other: "home" | "away") => segments.filter((item) => (item[side] ?? 0) > (item[other] ?? 0)).length
  return won("home", "away") <= sides.homeScore && won("away", "home") <= sides.awayScore ? { segments } : null
}

export function parseBreakdown(text: string | null | undefined, sport: SportId, sides: Sides): ScoreBreakdown | null {
  if (!text) return null
  if (sport === "basketball") return quarters(text, sides)
  if (sport === "baseball") return innings(text, sides)
  if (sport === "american-football") return regularPairs(text, QUARTER_HEADINGS, "quarter", sides)
  if (sport === "rugby") return regularPairs(text, HALF_HEADINGS, "half", sides)
  return sport === "volleyball" ? volleyballSets(text, sides) : null
}

const shortSide = (name: string) => name.replace(/\s+Cricket$/i, "")

export function parseCricketOutcome(text: string | null | undefined, sides: string[]) {
  for (const row of lines(text ?? "")) {
    const match = row.match(/^(.+?) won by (\d+) (wicket|run)s?\b/)
    const winner = sides.find((side) => shortSide(side) === match?.[1])
    if (match && winner) return { winner, margin: { value: Number(match[2]), unit: match[3] === "run" ? ("runs" as const) : ("wickets" as const) } }
  }
  return null
}

/** Overs appear only in the result text, so a line must carry the side's own runs to count. */
export function parseCricketOvers(text: string | null | undefined, side: string, runs: number): string | null {
  for (const row of lines(text ?? "")) {
    const match = row.match(/^(.+?)\s+(\d+)(?:\/\d+)?\s+\((\d+(?:\.\d)?) overs\)$/)
    if (match && match[1] === shortSide(side) && Number(match[2]) === runs) return match[3]
  }
  return null
}
