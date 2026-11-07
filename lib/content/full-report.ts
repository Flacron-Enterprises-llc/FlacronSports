// The paid report: facts from the match record, in plain sentences, in each sport's own
// terms. Nothing here is generated or estimated, so an event with no published detail
// has no full report.

import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n"
import { lineScore, type LineTable } from "@/lib/sports/adapters/line-score"
import type { MatchDetail, StatRow, TimelineItem } from "@/lib/sports/detail"
import { decidedSide, setsWinner } from "@/lib/sports/game-result"
import { resultLine, resultNote, setsWon } from "@/lib/sports/presentation"
import { resultFacts, sportSteps, type Fact } from "@/lib/sports/sport-terms"
import type { CombatMethod, EventScore, ScoreSegment, SportEvent, SportId } from "@/lib/sports/types"

export interface FullReportMoment extends Pick<TimelineItem, "id" | "minute" | "kind" | "player" | "secondary"> {
  team: string | null
}

export interface FullReport {
  tier: "plus" | "premium"
  state: "ok" | "empty"
  moments: FullReportMoment[]
  summary: string[]
  /** Premium only. */
  stats?: StatRow[]
  insights?: string[]
}

type Unit = [one: string, many: string]

const COPY: Record<Locale, {
  goals: string; cards: string; subs: string; venue: string; xg: string; shots: string; possession: string; saves: string
  classification: string; factColon: string
  wonBy: string; wonEnding: string; level: string; wonInSets: string; wonSegments: string; gamesWon: string; tiebreaks: string
  highestInnings: string; bouts: string; first: string; firstFromPole: string; placesGained: string; leader: string
  units: Partial<Record<SportId, Unit>>; segments: Partial<Record<ScoreSegment["kind"], string>>
}> = {
  en: {
    goals: "{count} goals were scored.",
    cards: "{count} red cards were shown.",
    subs: "The teams made {count} substitutions between them.",
    venue: "It took place at {venue}.",
    xg: "{team} scored {goals} from {xg} expected goals.",
    shots: "{team} put {on} of {total} shots on target.",
    possession: "{team} had {value} of the ball.",
    saves: "{team}'s goalkeeper made {value} saves.",
    classification: "Classification: {result}.",
    factColon: ":",
    wonBy: "{team} won by {value} {unit}{ending}.",
    wonEnding: "{team} won, {ending}.",
    level: "The game finished level at {home}-{away}.",
    wonInSets: "{team} won the match {won}-{lost} in sets.",
    wonSegments: "{team} won {count} of the {total} {unit}.",
    gamesWon: "Games won: {first} {firstGames}, {second} {secondGames}.",
    tiebreaks: "Sets decided by a tiebreak: {count}.",
    highestInnings: "The highest innings was {runs}, by {team}.",
    bouts: "Of the {count} bouts with a result, {finishes} ended inside the distance and {decisions} went to the judges.",
    first: "{name} finished first.",
    firstFromPole: "{name} started from pole position and finished first.",
    placesGained: "{name} gained the most places, from {grid} on the grid to {position}.",
    leader: "{name} leads the championship on {points} points.",
    units: { football: ["goal", "goals"], "ice-hockey": ["goal", "goals"], basketball: ["point", "points"], "american-football": ["point", "points"], rugby: ["point", "points"], baseball: ["run", "runs"] },
    segments: { quarter: "quarters", half: "halves", period: "periods", set: "sets" },
  },
  fr: {
    goals: "{count} buts ont été marqués.",
    cards: "{count} cartons rouges ont été distribués.",
    subs: "Les équipes ont effectué {count} remplacements au total.",
    venue: "La rencontre s'est jouée à {venue}.",
    xg: "{team} a marqué {goals} but(s) pour {xg} buts attendus.",
    shots: "{team} a cadré {on} tirs sur {total}.",
    possession: "{team} a eu {value} de possession.",
    saves: "Le gardien de {team} a réalisé {value} arrêts.",
    classification: "Classement : {result}.",
    factColon: " :",
    wonBy: "{team} a gagné de {value} {unit}{ending}.",
    wonEnding: "{team} a gagné, {ending}.",
    level: "La rencontre s'est terminée à égalité, {home}-{away}.",
    wonInSets: "{team} a remporté le match {won}-{lost} en sets.",
    wonSegments: "{team} a remporté {count} des {total} {unit}.",
    gamesWon: "Jeux gagnés : {first} {firstGames}, {second} {secondGames}.",
    tiebreaks: "Sets décidés au tie-break : {count}.",
    highestInnings: "La manche la plus haute a été de {runs}, pour {team}.",
    bouts: "Sur les {count} combats avec un résultat, {finishes} se sont terminés avant la limite et {decisions} ont été tranchés par les juges.",
    first: "{name} a terminé premier.",
    firstFromPole: "{name} est parti en pole position et a terminé premier.",
    placesGained: "{name} a gagné le plus de places, de la {grid}e sur la grille à la {position}e.",
    leader: "{name} mène le championnat avec {points} points.",
    units: { football: ["but", "buts"], "ice-hockey": ["but", "buts"], basketball: ["point", "points"], "american-football": ["point", "points"], rugby: ["point", "points"], baseball: ["point", "points"] },
    segments: { quarter: "quart-temps", half: "mi-temps", period: "périodes", set: "sets" },
  },
}

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

const IMPORTANT: TimelineItem["kind"][] = ["goal", "penalty", "own-goal", "red"]
const GOAL_SPORTS = new Set<SportId>(["football", "ice-hockey"])
const FINISHES = new Set<CombatMethod>(["ko", "tko", "submission"])
const DECISIONS = new Set<CombatMethod>(["unanimous-decision", "split-decision", "majority-decision", "decision"])

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

/** "Score by quarter (A, B): Q1 28-24, Q2 19-30, Hits 9-7". The total is already in the result. */
function lineSentence({ caption, columns, rows: [first, second] }: LineTable): string[] {
  const cells = columns.flatMap((column, index) => {
    const [a, b] = [first.cells[index].value, second.cells[index].value]
    return column.key === "total" || a === null || b === null ? [] : [`${column.title ?? column.label} ${a}-${b}`]
  })
  return cells.length ? [`${caption} (${first.name}, ${second.name}): ${cells.join(", ")}.`] : []
}

function teamInsights(event: SportEvent, score: Extract<EventScore, { kind: "team" }>, t: Dictionary, locale: Locale, segments: ScoreSegment[]): string[] {
  const copy = COPY[locale]
  const names = event.participants.map((participant) => participant.name)
  const { conclusion } = event
  const ending = conclusion ? t.status.conclusions[conclusion].toLowerCase() : ""
  if (conclusion === "awarded" || conclusion === "walkover") return [sentence(t.status.conclusions[conclusion])]

  const decided = decidedSide(event)
  const lines: string[] = []
  if (decided?.winner === null) lines.push(fill(copy.level, { home: score.home, away: score.away }))
  else if (decided) {
    const team = names[decided.winner]
    const [won, lost] = [Math.max(score.home, score.away), Math.min(score.home, score.away)]
    const margin = won - lost
    const unit = copy.units[event.sportId]
    if (event.sportId === "volleyball") lines.push(fill(copy.wonInSets, { team, won, lost }))
    else if (conclusion === "penalties" || conclusion === "shootout" || margin === 0 || !unit) lines.push(fill(copy.wonEnding, { team, ending }))
    else lines.push(fill(copy.wonBy, { team, value: margin, unit: unit[margin === 1 ? 0 : 1], ending: ending ? ` (${ending})` : "" }))
  }
  if (event.shootout) lines.push(sentence(fill(t.match.shootoutScore, event.shootout)))

  const counted = segments.filter((item) => item.home !== null && item.away !== null && copy.segments[item.kind])
  const unit = copy.segments[counted[0]?.kind]
  if (names.length === 2 && unit && counted.length > 1 && counted.every((item) => item.kind === counted[0].kind)) {
    const homeWins = counted.filter((item) => (item.home as number) > (item.away as number)).length
    const awayWins = counted.filter((item) => (item.away as number) > (item.home as number)).length
    if (homeWins !== awayWins) lines.push(fill(copy.wonSegments, { team: names[homeWins > awayWins ? 0 : 1], count: Math.max(homeWins, awayWins), total: counted.length, unit }))
  }
  return lines
}

function setInsights(event: SportEvent, score: Extract<EventScore, { kind: "sets" }>, t: Dictionary, locale: Locale): string[] {
  const copy = COPY[locale]
  const won = setsWon(event)
  const winner = setsWinner(score)
  const lines: string[] = []
  if (won && winner && won[0] !== won[1]) lines.push(fill(copy.wonInSets, { team: winner, won: Math.max(...won), lost: Math.min(...won) }))
  else {
    const note = resultNote(event, t)
    if (note) lines.push(sentence(note))
  }
  const [first, second] = score.lines
  if (won && first && second) {
    const games = (line: typeof first) => line.games.reduce((sum, value) => sum + value, 0)
    lines.push(fill(copy.gamesWon, { first: first.name, firstGames: games(first), second: second.name, secondGames: games(second) }))
  }
  const tiebreaks = (score.tiebreaks ?? []).filter((value) => value !== null && value !== undefined).length
  if (tiebreaks > 0) lines.push(fill(copy.tiebreaks, { count: tiebreaks }))
  return lines
}

function inningsInsights(event: SportEvent, score: Extract<EventScore, { kind: "innings" }>, t: Dictionary, locale: Locale): string[] {
  const note = resultNote(event, t)
  const [home, away] = event.participants.map((participant) => participant.name)
  const list = [...(home ? (score.homeInnings ?? []).map((item) => ({ team: home, runs: item.runs })) : []), ...(away ? (score.awayInnings ?? []).map((item) => ({ team: away, runs: item.runs })) : [])]
  const highest = [...list].sort((a, b) => b.runs - a.runs)
  // Where each side bats once the totals already say this. A tie at the top names nobody.
  const clear = list.length > 2 && highest[0].runs > highest[1].runs
  return [...(note ? [sentence(note)] : []), ...(clear ? [fill(COPY[locale].highestInnings, highest[0])] : [])]
}

function combatInsights(event: SportEvent, t: Dictionary, locale: Locale): string[] {
  const note = resultNote(event, t)
  const bouts = event.details?.kind === "combat" ? event.details.bouts.filter((bout) => bout.winner) : []
  const finishes = bouts.filter((bout) => bout.method && FINISHES.has(bout.method)).length
  const decisions = bouts.filter((bout) => bout.method && DECISIONS.has(bout.method)).length
  const card = bouts.length > 1 && finishes + decisions > 0 ? [fill(COPY[locale].bouts, { count: bouts.length, finishes, decisions })] : []
  return [...(note ? [sentence(note)] : []), ...card]
}

function raceInsights(score: Extract<EventScore, { kind: "classification" }>, t: Dictionary, locale: Locale): string[] {
  const copy = COPY[locale]
  const winner = score.entries.find((entry) => entry.position === 1)
  const gains = score.entries.flatMap((entry) => (entry.grid && entry.grid > entry.position ? [{ ...entry, gain: entry.grid - entry.position }] : [])).sort((a, b) => b.gain - a.gain)
  const clearGain = gains[0] && gains[0].gain !== gains[1]?.gain
  const leader = score.standings?.find((entry) => entry.position === 1)
  return [
    ...(winner ? [fill(score.pole === winner.name ? copy.firstFromPole : copy.first, { name: winner.name })] : []),
    ...(clearGain ? [fill(copy.placesGained, { name: gains[0].name, grid: gains[0].grid as number, position: gains[0].position })] : []),
    ...(score.out?.length ? [`${t.sportTerms.notClassified}${copy.factColon} ${score.out.length}.`] : []),
    ...(leader ? [fill(copy.leader, { name: leader.name, points: leader.points })] : []),
  ]
}

/** What the result itself shows, read by the sport's own score. Every figure comes from the event. */
function resultInsights(event: SportEvent, t: Dictionary, locale: Locale, segments: ScoreSegment[]): string[] {
  const { score } = event
  if (score.kind === "team") return teamInsights(event, score, t, locale, segments)
  if (score.kind === "sets") return setInsights(event, score, t, locale)
  if (score.kind === "innings") return inningsInsights(event, score, t, locale)
  if (score.kind === "combat") return combatInsights(event, t, locale)
  return score.kind === "classification" ? raceInsights(score, t, locale) : []
}

export function buildFullReport(event: SportEvent, detail: MatchDetail, tier: FullReport["tier"], locale: Locale): FullReport {
  const copy = COPY[locale]
  const t = getDictionary(locale)
  const [home, away] = event.participants.map((participant) => participant.name)
  const teamOf = (side: TimelineItem["side"]) => (side === "home" ? home : side === "away" ? away : null) ?? null
  const moments = detail.timeline
    .filter((item) => IMPORTANT.includes(item.kind))
    .map(({ id, minute, kind, player, secondary, side }) => ({ id, minute, kind, player, secondary, team: teamOf(side) }))

  const count = (kinds: TimelineItem["kind"][]) => detail.timeline.filter((item) => kinds.includes(item.kind)).length
  const goals = count(["goal", "penalty", "own-goal"])
  const reds = count(["red"])
  const subs = count(["substitution"])
  const fact = ({ label, value }: Fact) => `${label}${copy.factColon} ${value}.`
  const breakdown = event.breakdown ?? detail.breakdown
  const line = event.score.kind === "team" ? lineScore({ ...event, breakdown }, t) : null
  const classified = event.score.kind === "classification" ? resultLine(event, t) : null
  // The steps are bare lines, so a list of them still reads as sentences in one paragraph.
  const story = [
    ...sportSteps(event, t).map(sentence),
    ...(classified ? [fill(copy.classification, { result: classified })] : []),
    ...(line ? lineSentence(line) : []),
    ...(goals > 1 && GOAL_SPORTS.has(event.sportId) ? [fill(copy.goals, { count: goals })] : []),
    ...(reds > 1 ? [fill(copy.cards, { count: reds })] : []),
    ...(subs > 1 ? [fill(copy.subs, { count: subs })] : []),
    ...resultFacts(event, t).map(fact),
  ]
  const summary = [...story, ...(event.venue ? [fill(copy.venue, { venue: event.venue })] : [])]
  // A venue alone is not a report, and neither is a timeline with nothing worth repeating.
  const told = moments.length > 0 || story.length > 0
  if (tier === "plus") return { tier, state: told ? "ok" : "empty", moments, summary }

  const stat = (key: string) => detail.stats.find((row) => row.key === key)
  const insights: string[] = []
  const sides = [
    { team: home, side: "home" as const, goals: event.score.kind === "team" ? event.score.home : null },
    { team: away, side: "away" as const, goals: event.score.kind === "team" ? event.score.away : null },
  ]
  for (const { team, side, goals: scored } of sides) {
    if (!team) continue
    const xg = stat("expected_goals")?.[side]
    if (xg && scored !== null) insights.push(fill(copy.xg, { team, goals: scored, xg }))
    const on = stat("shots on goal")?.[side]
    const total = stat("total shots")?.[side]
    if (on && total && Number(total) > 0) insights.push(fill(copy.shots, { team, on, total }))
    const saves = stat("goalkeeper saves")?.[side]
    if (saves && Number(saves) > 0) insights.push(fill(copy.saves, { team, value: saves }))
  }
  const possession = stat("ball possession")
  // A figure for one side only cannot say who led.
  if (possession?.home && possession.away && home && away) {
    const homeLeads = Number.parseFloat(possession.home) >= Number.parseFloat(possession.away)
    insights.unshift(fill(copy.possession, { team: homeLeads ? home : away, value: homeLeads ? possession.home : possession.away }))
  }
  const analysis = [...resultInsights(event, t, locale, breakdown?.segments ?? []), ...insights]
  return { tier, state: told || analysis.length > 0 || detail.stats.length > 0 ? "ok" : "empty", moments, summary, stats: detail.stats, insights: analysis }
}
