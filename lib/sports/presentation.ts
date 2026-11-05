// Wording for an event that does not fit "home v away". Shared by cards, alerts,
// reports, the digest, the assistant and exports so they cannot disagree.

import type { Dictionary } from "@/lib/i18n"
import type { EventScore, Innings, SportEvent } from "./types"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

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
  return innings.wickets === null ? String(innings.runs) : `${innings.runs}/${innings.wickets}`
}

function marginText(score: Extract<EventScore, { kind: "innings" }>, t: Dictionary): string | null {
  if (!score.winner) return null
  if (!score.margin) return fill(t.event.won, { name: score.winner })
  const { value, unit } = score.margin
  const label = t.event.units[value === 1 ? (unit === "runs" ? "run" : "wicket") : unit]
  return fill(t.event.wonBy, { name: score.winner, value, unit: label })
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
    return score.winner ? fill(t.event.won, { name: score.winner }) : null
  }
  if (score.kind === "innings") return marginText(score, t)
  return score.kind === "combat" ? combatText(score, t) : null
}

/** One value per participant row, for the forms that score each side separately. */
export function rowValues(event: SportEvent): (number | string | undefined)[] {
  const { score } = event
  if (score.kind === "team") return [score.home, score.away]
  if (score.kind === "innings") return [inningsText(score.home), inningsText(score.away)]
  if (score.kind === "sets") {
    return event.participants.map((participant) => score.lines.find((line) => line.name === participant.name)?.games.join(" "))
  }
  return event.participants.map(() => undefined)
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
  const values = rowValues(event)
  const rows = event.participants.flatMap((participant, index) => (values[index] === undefined ? [] : [`${participant.name} ${values[index]}`]))
  return [resultNote(event, t), rows.join(", ")].filter(Boolean).join(": ")
}
