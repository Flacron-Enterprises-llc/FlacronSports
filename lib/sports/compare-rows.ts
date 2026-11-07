// One wording for a comparison, shared by the screen and the PDF so they cannot disagree.

import type { Dictionary, Locale } from "@/lib/i18n"
import { hockeyRecord } from "./adapters/ice-hockey"
import type { Comparison, PlayerComparison, SplitRecord, TeamProfile } from "./compare"
import { SPORTS, type CricketFormat, type SportId } from "./types"

const CRICKET_FORMATS: CricketFormat[] = ["test", "odi", "t20", "first-class", "hundred"]

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

const dropped = (rows: ComparisonRow[]) => rows.filter(([, first, second]) => first !== BLANK || second !== BLANK)

/** The sport decides what a record reads like. A draw column only where the sport has draws. */
export function recordFor(record: SplitRecord, sport: SportId | null): string {
  if (!record.played) return BLANK
  if (sport === "cricket") return `${record.wins}-${record.losses}-${record.ties}-${record.noResults}`
  // American football writes a tie last: 5-3-1 is five wins, three losses and a tie.
  // So does baseball, where KBO and NPB games can end tied: KT were 90-49-5 in 2026.
  // A fighter's record is written the same way, 27-1-1.
  if (sport === "american-football" || sport === "baseball" || sport === "combat-sports") return record.draws ? `${record.wins}-${record.losses}-${record.draws}` : `${record.wins}-${record.losses}`
  if (sport === "ice-hockey" && !record.draws) return hockeyRecord(record.wins, record.losses - (record.overtimeLosses ?? 0), record.overtimeLosses ?? 0)
  return record.draws || sport === "football" || sport === "rugby" ? `${record.wins}-${record.draws}-${record.losses}` : `${record.wins}-${record.losses}`
}

const perPlayed = (record: SplitRecord, total: number) => perGame(total, record.counted)

const signed = (value: number) => (value > 0 ? `+${value}` : String(value))

export function teamSheet(data: Comparison, t: Dictionary): ComparisonSheet {
  const copy = t.compare
  const [one, two] = data.teams
  const sport = data.sportId ?? "football"
  const terms = copy.bySport[sport]
  const both = (label: string, read: (team: TeamProfile) => string | number | null | undefined): ComparisonRow => {
    const text = (team: TeamProfile) => String(read(team) ?? BLANK)
    return [label, text(one), text(two)]
  }
  const extra = (label: string, read: (figures: NonNullable<TeamProfile["advanced"]>) => string | number | null | undefined) => both(label, (team) => (team.advanced ? read(team.advanced) : null))
  // A level American football game is a tie, never a draw.
  const letter = (result: TeamProfile["form"][number]) => copy.letters[sport === "american-football" && result === "D" ? "T" : result]
  const form = both(copy.form, (team) => team.form.map(letter).join(" ") || BLANK)
  const paired = (read: (team: TeamProfile) => number | null | undefined) => (team: TeamProfile) => read(team) ?? null

  let rows: ComparisonRow[]
  if (sport === "combat-sports") {
    rows = [form, both(terms.record, (team) => recordFor(team.record, sport)), both(copy.koWins, paired((team) => team.combat?.ko)), both(copy.submissionWins, paired((team) => team.combat?.submission)), both(copy.decisionWins, paired((team) => team.combat?.decision))]
  } else if (sport === "motorsport") {
    const racing = (read: (figures: NonNullable<TeamProfile["racing"]>) => string | number | null) => (team: TeamProfile) => (team.racing?.races ? read(team.racing) : null)
    rows = [
      form,
      both(terms.record, racing((figures) => `${figures.wins}/${figures.races}`)),
      both(copy.podiums, racing((figures) => figures.podiums)),
      both(copy.bestFinish, racing((figures) => figures.best)),
      both(copy.averageFinish, racing((figures) => (figures.average === null ? null : figures.average.toFixed(1)))),
      both(copy.racePoints, racing((figures) => figures.points)),
      both(copy.retirements, racing((figures) => figures.retirements)),
    ]
  } else {
    const sides = [
      both(terms.record, (team) => recordFor(team.record, sport)),
      both(terms.scored, (team) => perPlayed(team.record, team.record.scored)),
      both(terms.conceded, (team) => perPlayed(team.record, team.record.conceded)),
      both(terms.difference, (team) => (team.record.counted ? signed(team.record.scored - team.record.conceded) : null)),
    ]
    const shared = sport === "tennis" ? [both(copy.straightSets, (team) => team.tennis?.straightSets), both(copy.tiebreaks, (team) => team.tennis?.tiebreaks)] : []
    const formats = sport === "cricket"
      ? CRICKET_FORMATS.map((format) => extra(copy.formatRecord.replace("{format}", t.sportTerms.cricketFormats[format]), (figures) => {
          const record = figures.cricket?.byFormat[format]
          return record ? recordFor(record, sport) : null
        }))
      : []
    const blanks = "blanks" in terms ? [extra(terms.blanks as string, (figures) => figures.cleanSheets)] : []
    const silent = "silent" in terms ? [extra(terms.silent as string, (figures) => figures.failedToScore)] : []
    const overtime = sport === "ice-hockey" || sport === "basketball" || sport === "american-football" ? [extra(copy.overtimeGames, (figures) => figures.overtimeGames)] : []
    const table = [
      extra(copy.position, (figures) => figures.standing?.rank),
      ...(sport === "cricket" ? [] : [extra(copy.points, (figures) => figures.standing?.points)]),
    ]
    rows = [
      form,
      ...sides,
      ...shared,
      ...(data.tier === "advanced"
        ? [
            extra(copy.homeRecord, (figures) => recordFor(figures.home, sport)),
            extra(copy.awayRecord, (figures) => recordFor(figures.away, sport)),
            ...formats,
            ...(sport === "cricket"
              ? [
                  extra(copy.highest, (figures) => figures.cricket?.highest),
                  extra(copy.lowest, (figures) => figures.cricket?.lowest),
                  extra(copy.winsByRuns, (figures) => figures.cricket?.winsByRuns),
                  extra(copy.winsByWickets, (figures) => figures.cricket?.winsByWickets),
                ]
              : []),
            ...blanks,
            ...silent,
            ...overtime,
            ...table,
          ]
        : []),
    ]
  }
  const basis = (copy.basisBySport as Partial<Record<SportId, string>>)[sport] ?? copy.basis
  const notes = [basis, ...(data.tier === "advanced" ? data.headToHead.map((game) => `${copy.headToHead}: ${game.title} ${game.result}`) : [])]
  return { title: `${one.name} / ${two.name}`, measure: copy.measure, names: [one.name, two.name], rows: dropped(rows), notes, footer: copy.pdfFooter }
}
