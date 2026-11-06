// One wording for a comparison, shared by the screen and the PDF so they cannot disagree.

import type { Dictionary, Locale } from "@/lib/i18n"
import type { Comparison, PlayerComparison, SplitRecord, TeamProfile } from "./compare"
import { SPORTS } from "./types"

export type ComparisonRow = [label: string, first: string, second: string]

export interface ComparisonSheet {
  title: string
  measure: string
  names: [string, string]
  rows: ComparisonRow[]
  notes: string[]
  footer: string
}

const BLANK = "–"

export const recordLine = (record: SplitRecord) => (record.played ? `${record.wins}-${record.draws}-${record.losses}` : BLANK)
export const perGame = (total: number, played: number) => (played ? (total / played).toFixed(1) : BLANK)

export function formatBorn(born: string | null, locale: Locale): string | null {
  return born ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${born}T12:00:00Z`)) : null
}

/** A row nobody has a value for is dropped. One side's gap shows a dash, never a zero. */
export function playerRows(data: PlayerComparison, t: Dictionary, locale: Locale): ComparisonRow[] {
  const [one, two] = data.players
  const profile = (label: string, read: (player: typeof one.profile) => string | null): [string, string | null, string | null] => [label, read(one.profile), read(two.profile)]
  const advanced = (label: string, read: (facts: NonNullable<typeof one.advanced>) => string | null): [string, string | null, string | null] => [label, one.advanced ? read(one.advanced) : null, two.advanced ? read(two.advanced) : null]
  const copy = t.discover
  const sport = (id: string) => SPORTS.find((item) => item.id === id)?.name[locale] ?? null
  const rows = [
    profile(copy.sport, (player) => sport(player.sportId)),
    profile(copy.team, (player) => player.team),
    profile(copy.position, (player) => player.position),
    profile(copy.nationality, (player) => player.nationality),
    profile(copy.born, (player) => formatBorn(player.born, locale)),
    profile(copy.number, (player) => player.number),
    profile(copy.height, (player) => player.height),
    profile(copy.weight, (player) => player.weight),
    ...(data.tier === "advanced"
      ? [
          advanced(t.compare.side, (facts) => facts.side),
          advanced(t.compare.birthplace, (facts) => facts.birthplace),
          advanced(t.compare.wage, (facts) => facts.wage),
        ]
      : []),
  ]
  return rows.flatMap(([label, first, second]) => (first || second ? [[label, first ?? BLANK, second ?? BLANK] as ComparisonRow] : []))
}

export function playerSheet(data: PlayerComparison, t: Dictionary, locale: Locale): ComparisonSheet {
  const names: [string, string] = [data.players[0].profile.name, data.players[1].profile.name]
  return { title: names.join(" / "), measure: t.compare.measure, names, rows: playerRows(data, t, locale), notes: [t.compare.playerBasis], footer: t.compare.pdfFooter }
}

export function teamSheet(data: Comparison, t: Dictionary): ComparisonSheet {
  const copy = t.compare
  const [one, two] = data.teams
  const both = (label: string, read: (team: TeamProfile) => string): ComparisonRow => [label, read(one), read(two)]
  const extra = (label: string, read: (figures: NonNullable<TeamProfile["advanced"]>) => string | number | null | undefined) =>
    both(label, (team) => String((team.advanced ? read(team.advanced) : null) ?? BLANK))
  const rows: ComparisonRow[] = [
    both(copy.form, (team) => team.form.map((result) => copy.letters[result]).join(" ") || BLANK),
    both(copy.record, (team) => recordLine(team.record)),
    both(copy.scoredAverage, (team) => perGame(team.record.scored, team.record.played)),
    both(copy.concededAverage, (team) => perGame(team.record.conceded, team.record.played)),
    ...(data.tier === "advanced"
      ? [
          extra(copy.homeRecord, (figures) => recordLine(figures.home)),
          extra(copy.awayRecord, (figures) => recordLine(figures.away)),
          extra(copy.cleanSheets, (figures) => figures.cleanSheets),
          extra(copy.failedToScore, (figures) => figures.failedToScore),
          extra(copy.position, (figures) => figures.standing?.rank),
          extra(copy.points, (figures) => figures.standing?.points),
          extra(copy.goalDifference, (figures) => figures.standing?.difference),
        ]
      : []),
  ]
  const notes = [copy.basis, ...(data.tier === "advanced" ? data.headToHead.map((game) => `${copy.headToHead}: ${game.title} ${game.home}-${game.away}`) : [])]
  return { title: `${one.name} / ${two.name}`, measure: copy.measure, names: [one.name, two.name], rows, notes, footer: copy.pdfFooter }
}
