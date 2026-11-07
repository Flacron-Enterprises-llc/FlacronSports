// Wording for an event that does not fit "home v away". Shared by cards, alerts,
// reports, the digest, the assistant and exports so they cannot disagree.

import type { Dictionary } from "@/lib/i18n"
import { currentPeriod } from "./thesportsdb"
import type { EventScore, Innings, SportEvent, SportId } from "./types"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

const SPORT_PHASES = new Set<SportId>(["basketball", "ice-hockey", "american-football", "baseball", "rugby", "volleyball"])

/** Bare minutes read as minutes. Anything else the feed writes is already a clock. */
export const clockText = (clock: string) => (/^\d+$/.test(clock) ? `${clock}′` : clock)

/** The sport's own word for where a live game is: Q2, P3, Inning 7, Set 3 or overtime. */
export function livePhase(event: Pick<SportEvent, "status" | "sportId" | "providerStatus" | "competition">, t: Dictionary): string | null {
  if (event.status !== "live" || !SPORT_PHASES.has(event.sportId)) return null
  const phase = currentPeriod(event.providerStatus, event.sportId, event.competition.name)
  return phase ? t.match.periodsShort[phase.key].replace("{n}", String(phase.number ?? "")) : null
}

/** Baseball's feed repeats the phase as a code ("IN4") in the clock field. Only a running clock adds anything. */
export function liveClock(event: Pick<SportEvent, "status" | "clock">, phase: string | null): string | null {
  if (event.status !== "live" || !event.clock) return null
  if (phase && !/^\d/.test(event.clock)) return null
  return clockText(event.clock)
}

/** Sets won by each side, in participant order, or null when a set was left unfinished. */
export function setsWon(event: Pick<SportEvent, "score" | "participants">): [number, number] | null {
  const { score, participants } = event
  if (score.kind !== "sets" || score.retired || score.walkover || participants.length !== 2) return null
  const [first, second] = participants.map((participant) => score.lines.find((line) => line.name === participant.name))
  if (!first || !second || first.games.length === 0 || first.games.length !== second.games.length) return null
  const wins = (mine: number[], theirs: number[]) => mine.filter((games, index) => games > theirs[index]).length
  return [wins(first.games, second.games), wins(second.games, first.games)]
}

export function isDuel(event: SportEvent): boolean {
  return event.participants.length === 2 && event.score.kind !== "classification"
}

/** Never lists a classification's entrants: their order is the result. */
export function eventTitle(event: SportEvent): string {
  return isDuel(event) ? event.participants.map((participant) => participant.name).join(" / ") : event.eventName || event.competition.name
}

export function hasResult(event: SportEvent): boolean {
  return event.score.kind !== "none"
}

export function inningsText(innings: Innings | null): string | undefined {
  if (!innings) return undefined
  const score = innings.wickets === null ? String(innings.runs) : `${innings.runs}/${innings.wickets}`
  return `${score}${innings.declared ? "d" : ""}`
}

/** Both innings where a side bats twice, as a card reads them: "244 & 319/9d". */
export const inningsLine = (list: Innings[] | undefined, total: Innings | null): string | undefined =>
  list ? list.map(inningsText).join(" & ") : inningsText(total)

function marginText(score: Extract<EventScore, { kind: "innings" }>, t: Dictionary): string | null {
  if (score.outcome && score.outcome !== "won") return t.event.cricketOutcomes[score.outcome]
  if (!score.winner) return null
  if (!score.margin) return fill(t.event.won, { name: score.winner })
  const { value, unit } = score.margin
  const label = t.event.units[value === 1 ? (unit === "runs" ? "run" : "wicket") : unit]
  const won = fill(score.byInnings ? t.event.wonByInnings : t.event.wonBy, { name: score.winner, value, unit: label })
  return score.method === "dls" ? `${won} (${t.event.dls})` : won
}

function combatText(score: Extract<EventScore, { kind: "combat" }>, t: Dictionary): string {
  const parts = [fill(t.event.won, { name: score.winner })]
  if (score.method) parts.push(t.event.methods[score.method])
  if (score.round) parts.push(fill(t.event.round, { round: score.round }) + (score.time ? ` (${score.time})` : ""))
  return parts.join(", ")
}

/** The line under the participants, naming the outcome. Null when there is nothing to add. */
export function resultNote(event: SportEvent, t: Dictionary): string | null {
  const { score } = event
  if (score.kind === "sets") {
    if (score.retired) return fill(t.event.retired, { name: score.retired })
    if (score.walkover && score.winner) return fill(t.event.walkover, { name: score.winner })
    return score.winner ? fill(t.event.won, { name: score.winner }) : null
  }
  if (score.kind === "innings") return marginText(score, t)
  return score.kind === "combat" ? combatText(score, t) : null
}

/** One value per participant row, for the forms that score each side separately. */
export function rowValues(event: SportEvent): (number | string | undefined)[] {
  const { score } = event
  if (score.kind === "team") return [score.home, score.away]
  if (score.kind === "innings") return [inningsLine(score.homeInnings, score.home), inningsLine(score.awayInnings, score.away)]
  if (score.kind === "sets") {
    return event.participants.map((participant) => score.lines.find((line) => line.name === participant.name)?.games.join(" ") || undefined)
  }
  return event.participants.map(() => undefined)
}

/** "6-4, 3-6, 7-5", winner first, for a match played out. A retirement keeps its unfinished rows. */
function setScores(score: Extract<EventScore, { kind: "sets" }>): string | null {
  const winner = score.lines.find((line) => line.name === score.winner)
  const loser = score.lines.find((line) => line.name !== score.winner)
  if (score.retired || !winner || !loser || winner.games.length === 0 || winner.games.length !== loser.games.length) return null
  return winner.games.map((games, index) => `${games}-${loser.games[index]}`).join(", ")
}

/** The whole result as one plain sentence fragment, or null when the event has none. */
export function resultLine(event: SportEvent, t: Dictionary): string | null {
  const { score } = event
  if (score.kind === "none") return null
  if (score.kind === "team") return `${score.home} - ${score.away}`
  if (score.kind === "combat") return combatText(score, t)
  if (score.kind === "classification") {
    return score.entries.slice(0, 3).map((entry) => `${entry.position}. ${entry.name}`).join(", ")
  }
  const sets = score.kind === "sets" ? setScores(score) : null
  if (sets) return `${resultNote(event, t)} ${sets}`
  const values = rowValues(event)
  const rows = event.participants.flatMap((participant, index) => (values[index] === undefined ? [] : [`${participant.name} ${values[index]}`]))
  return [resultNote(event, t), rows.join(", ")].filter(Boolean).join(": ")
}
