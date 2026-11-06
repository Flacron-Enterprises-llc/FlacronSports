// Turns a game's typed breakdown into the table a person reads, in that sport's own
// columns: 1 to 9 then R, H, E for baseball; Q1 to Q4 for basketball; sets for volleyball.

import type { Dictionary } from "@/lib/i18n"
import type { ScoreBreakdown, ScoreSegment, SportEvent } from "../types"

export interface LineCell {
  /** "X" is baseball's mark for a home side that had no need to bat. */
  value: number | "X" | null
}

export interface LineColumn {
  key: string
  label: string
  /** The whole word, where the label is a letter. */
  title?: string
  total?: boolean
}

export interface LineTable {
  caption: string
  columns: LineColumn[]
  rows: { side: "home" | "away"; name: string; cells: LineCell[] }[]
}

type Size = "long" | "short"

export function segmentHeading(item: ScoreSegment, segments: ScoreSegment[], t: Dictionary, size: Size = "long"): string {
  const words = size === "short" ? t.match.segmentsShort : t.match.segments
  const several = segments.filter((other) => other.kind === "overtime").length > 1
  const template = item.kind === "overtime" ? (several ? words.overtimeNumbered : words.overtime) : words[item.kind]
  return template.replace("{n}", String(item.number))
}

const CAPTIONS: Record<ScoreSegment["kind"], keyof Dictionary["match"]["lineCaptions"]> = {
  quarter: "quarter",
  half: "half",
  period: "period",
  inning: "inning",
  extras: "inning",
  set: "set",
  overtime: "quarter",
  shootout: "period",
}

function totals(event: SportEvent, breakdown: ScoreBreakdown, t: Dictionary): { columns: LineColumn[]; home: LineCell[]; away: LineCell[] } {
  const { score } = event
  const columns: LineColumn[] = []
  const home: LineCell[] = []
  const away: LineCell[] = []
  const add = (column: LineColumn, values: { home: number; away: number } | undefined) => {
    if (!values) return
    columns.push(column)
    home.push({ value: values.home })
    away.push({ value: values.away })
  }
  const side = score.kind === "team" ? { home: score.home, away: score.away } : undefined
  const baseball = breakdown.segments[0]?.kind === "inning"
  const sets = breakdown.segments[0]?.kind === "set"
  add({ key: "total", label: baseball ? t.match.lineRuns : sets ? t.match.lineSets : t.match.lineTotal, title: baseball ? t.match.lineRunsTitle : sets ? t.event.sets : t.match.lineTotalTitle, total: true }, side)
  add({ key: "hits", label: t.match.lineHits, title: t.match.stats.hits, total: true }, breakdown.hits)
  add({ key: "errors", label: t.match.lineErrors, title: t.match.stats.errors, total: true }, breakdown.errors)
  add({ key: "tries", label: t.match.lineTries, title: t.match.lineTries, total: true }, breakdown.tries)
  return { columns, home, away }
}

/** Null when the source gave no breakdown for this game. */
export function lineScore(event: SportEvent, t: Dictionary, size: Size = "long"): LineTable | null {
  const breakdown = event.breakdown
  const [home, away] = event.participants
  if (!breakdown || !home || !away || (!breakdown.segments.length && !breakdown.tries)) return null
  const { segments } = breakdown
  const end = totals(event, breakdown, t)
  const columns: LineColumn[] = [...segments.map((item) => ({ key: `${item.kind}-${item.number}`, label: segmentHeading(item, segments, t, size) })), ...end.columns]
  const homeCell = (item: ScoreSegment, index: number): LineCell => {
    const skipped = item.kind === "inning" && item.home === null && item.away !== null && index === segments.length - 1
    return { value: skipped ? "X" : item.home }
  }
  const rows: LineTable["rows"] = [
    { side: "home", name: home.name, cells: [...segments.map(homeCell), ...end.home] },
    { side: "away", name: away.name, cells: [...segments.map((item) => ({ value: item.away })), ...end.away] },
  ]
  const baseball = segments[0]?.kind === "inning"
  return {
    caption: segments[0] ? t.match.lineCaptions[CAPTIONS[segments[0].kind]] : t.match.byPeriod,
    columns,
    // The visiting side bats first and a line score reads that way.
    rows: baseball ? [rows[1], rows[0]] : rows,
  }
}
