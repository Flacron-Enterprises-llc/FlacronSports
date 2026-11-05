// Strict readers for the free-form result field. Each one returns null unless the
// whole text fits the expected shape, so a format change hides a result rather than
// showing a wrong one. Provider prose is never kept: it can name other publishers,
// and one sampled card contradicted itself, so only checked facts leave this file.

import type { ClassificationEntry, CombatMethod, EventScore, SetLine } from "./types"

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
  return name && cells[3] ? { position: Number(cells[0]), name, team: cells[3], time: finishTime(cells[5]) } : null
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
