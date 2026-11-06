// The paid report: facts from the match record, in plain sentences. Nothing here is
// generated or estimated, so a game with no published detail has no full report.

import type { Locale } from "@/lib/i18n"
import type { MatchDetail, StatRow, TimelineItem } from "@/lib/sports/detail"
import type { SportEvent } from "@/lib/sports/types"

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

const COPY: Record<Locale, { goals: string; cards: string; subs: string; venue: string; xg: string; shots: string; possession: string; saves: string }> = {
  en: {
    goals: "{count} goals were scored.",
    cards: "{count} red cards were shown.",
    subs: "The teams made {count} substitutions between them.",
    venue: "It took place at {venue}.",
    xg: "{team} scored {goals} from {xg} expected goals.",
    shots: "{team} put {on} of {total} shots on target.",
    possession: "{team} had {value} of the ball.",
    saves: "{team}'s goalkeeper made {value} saves.",
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
  },
}

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

const IMPORTANT: TimelineItem["kind"][] = ["goal", "penalty", "own-goal", "red"]

export function buildFullReport(event: SportEvent, detail: MatchDetail, tier: FullReport["tier"], locale: Locale): FullReport {
  const copy = COPY[locale]
  const [home, away] = event.participants.map((participant) => participant.name)
  const teamOf = (side: TimelineItem["side"]) => (side === "home" ? home : side === "away" ? away : null) ?? null
  const moments = detail.timeline
    .filter((item) => IMPORTANT.includes(item.kind))
    .map(({ id, minute, kind, player, secondary, side }) => ({ id, minute, kind, player, secondary, team: teamOf(side) }))

  const count = (kinds: TimelineItem["kind"][]) => detail.timeline.filter((item) => kinds.includes(item.kind)).length
  const goals = count(["goal", "penalty", "own-goal"])
  const reds = count(["red"])
  const subs = count(["substitution"])
  const summary = [
    ...(goals > 1 ? [fill(copy.goals, { count: goals })] : []),
    ...(reds > 1 ? [fill(copy.cards, { count: reds })] : []),
    ...(subs > 1 ? [fill(copy.subs, { count: subs })] : []),
    ...(event.venue ? [fill(copy.venue, { venue: event.venue })] : []),
  ]
  const state = detail.timeline.length > 0 || detail.stats.length > 0 ? "ok" : "empty"
  if (tier === "plus") return { tier, state, moments, summary }

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
  return { tier, state, moments, summary, stats: detail.stats, insights }
}
