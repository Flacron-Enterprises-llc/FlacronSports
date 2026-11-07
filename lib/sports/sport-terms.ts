// What each sport's page says beyond the shared layout, as plain label and value pairs.
// Facts carry no result, so they show in spoiler mode. Stats and steps do, so the
// components keep them behind the reveal.

import type { Dictionary } from "@/lib/i18n"
import { inningsLine } from "./presentation"
import type { AmericanFootballDetails, BasketballDetails, CombatBout, CombatDetails, CricketDetails, EventScore, FootballDetails, MotorsportDetails, RugbyDetails, SportEvent, TennisDetails, VolleyballDetails } from "./types"

export interface Fact {
  label: string
  value: string
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

const facts = (rows: [string, string | number | null | undefined | false][]): Fact[] =>
  rows.flatMap(([label, value]) => (value === null || value === undefined || value === false || value === "" ? [] : [{ label, value: String(value) }]))

const place = (...parts: (string | null)[]) => parts.filter(Boolean).join(", ")

function cricketFacts(details: CricketDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.format, details.format && copy.cricketFormats[details.format]],
    [copy.match, details.matchLabel],
    [copy.stage, details.stage && copy.cricketStages[details.stage]],
    [copy.group, details.group],
    [copy.phase, details.phase],
    // The source's round number in cricket is a fixture count, not a round anyone plays, so it stays out.
    [copy.season, details.season],
    [copy.scheduled, details.scheduledDays && fill(copy.days, { days: details.scheduledDays })],
    [copy.start, details.dayNight && copy.dayNight],
    [copy.place, place(details.city, details.country)],
    [copy.category, details.women && copy.gender.women],
    [copy.toss, details.toss && fill(copy.tossChoice[details.toss.choice], { name: details.toss.side })],
    [copy.umpires, details.umpires],
    [copy.spectators, details.spectators],
  ])
}

export function tennisRoundText(round: TennisDetails["round"], t: Dictionary): string | null {
  if (!round) return null
  return round.key === "round" ? fill(t.sportTerms.roundNumber, { n: round.number ?? "" }) : t.sportTerms.tennisRounds[round.key]
}

function tennisFacts(details: TennisDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.tournament, details.tournament],
    [copy.round, tennisRoundText(details.round, t)],
    [copy.group, details.group],
    [copy.draw, copy.tennisFormats[details.format]],
    [copy.category, details.gender && copy.gender[details.gender]],
    [copy.season, details.season],
    [copy.place, place(details.city, details.country)],
  ])
}

export function sessionText(details: MotorsportDetails, t: Dictionary): string {
  const name = t.sportTerms.sessions[details.session]
  return details.sessionNumber ? `${name} ${details.sessionNumber}` : name
}

function motorsportFacts(details: MotorsportDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.session, sessionText(details, t)],
    [copy.weekend, details.weekend],
    [copy.class, details.className],
    [copy.round, details.round],
    [copy.circuit, details.circuit],
    [copy.place, place(details.city, details.country)],
    [copy.season, details.season],
    [copy.scheduledLaps, details.scheduledLaps],
  ])
}

/** Weight classes come in English. French reads them from its own table, longest name first. */
export function weightClassText(text: string, t: Dictionary): string {
  const { weights, womensClass } = t.sportTerms
  if (!womensClass) return text
  const named = Object.keys(weights).sort((a, b) => b.length - a.length).reduce((result, name) => result.replace(new RegExp(name, "gi"), weights[name]), text)
  const women = /^Women's\s+/i
  return women.test(named) ? `${named.replace(women, "")} ${womensClass}` : named
}

export const boutRounds = (bout: Pick<CombatBout, "scheduledRounds">, t: Dictionary) => (bout.scheduledRounds ? fill(t.sportTerms.scheduledRounds, { rounds: bout.scheduledRounds }) : null)

function combatFacts(details: CombatDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.discipline, details.discipline && copy.disciplines[details.discipline]],
    [copy.card, details.card],
    [copy.bouts, details.bouts.length],
    [copy.weightClass, details.weightClass && weightClassText(details.weightClass, t)],
    [copy.rounds, details.scheduledRounds],
    [copy.titleBout, details.title],
    [copy.place, place(details.city, details.country)],
    [copy.season, details.season],
    [copy.spectators, details.spectators],
  ])
}

function basketballFacts(details: BasketballDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.stage, details.stage && copy.basketballStages[details.stage]],
    [copy.round, details.round],
    [copy.group, details.group],
    [copy.season, details.season],
    [copy.place, place(details.city, details.country)],
    [copy.spectators, details.spectators],
  ])
}

function rugbyFacts(details: RugbyDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.discipline, details.code && copy.rugbyCodes[details.code]],
    [copy.stage, details.stage && copy.rugbyStages[details.stage]],
    [copy.round, details.round],
    [copy.group, details.group],
    [copy.season, details.season],
    [copy.place, place(details.city, details.country)],
    [copy.spectators, details.spectators],
  ])
}

/** "Week 9" in the regular season, the round's own name after it. */
export function americanFootballWhen(details: AmericanFootballDetails, t: Dictionary): string | null {
  const copy = t.sportTerms
  return details.stage ? copy.americanFootballStages[details.stage] : details.week ? fill(copy.weekNumber, { n: details.week }) : null
}

function americanFootballFacts(details: AmericanFootballDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [details.stage ? copy.stage : copy.week, americanFootballWhen(details, t)],
    [copy.season, details.season],
    [copy.place, place(details.city, details.country)],
    [copy.spectators, details.spectators],
  ])
}

function footballFacts(details: FootballDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.stage, details.stage && t.cups.rounds[details.stage]],
    [copy.round, details.round],
    [copy.group, details.group],
    [copy.season, details.season],
    [copy.place, place(details.city, details.country)],
  ])
}

function volleyballFacts(details: VolleyballDetails, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.stage, details.stage && copy.volleyballStages[details.stage]],
    [copy.round, details.round],
    [copy.group, details.group],
    [copy.format, details.goldenSet && copy.goldenSet],
    [copy.season, details.season],
    [copy.place, place(details.city, details.country)],
  ])
}

/** The golden set leads: its score is points, not sets, and the card must say so first. */
const volleyballChip = (details: VolleyballDetails, t: Dictionary) =>
  [details.goldenSet && t.sportTerms.goldenSet, details.stage && t.sportTerms.volleyballStages[details.stage], details.round && fill(t.sportTerms.roundNumber, { n: details.round }), details.group && `${t.sportTerms.group} ${details.group}`].filter(Boolean).join(" · ") || null

export function sportFacts(event: Pick<SportEvent, "details">, t: Dictionary): Fact[] {
  const { details } = event
  if (details?.kind === "football") return footballFacts(details, t)
  if (details?.kind === "basketball") return basketballFacts(details, t)
  if (details?.kind === "american-football") return americanFootballFacts(details, t)
  if (details?.kind === "rugby") return rugbyFacts(details, t)
  if (details?.kind === "volleyball") return volleyballFacts(details, t)
  if (details?.kind === "cricket") return cricketFacts(details, t)
  if (details?.kind === "tennis") return tennisFacts(details, t)
  if (details?.kind === "motorsport") return motorsportFacts(details, t)
  return details?.kind === "combat" ? combatFacts(details, t) : []
}

/** One short line for a card. It says what the event is and nothing about how it ended. */
export function sportChip(event: Pick<SportEvent, "details">, t: Dictionary): string | null {
  const { details } = event
  const copy = t.sportTerms
  if (details?.kind === "american-football") return americanFootballWhen(details, t)
  if (details?.kind === "rugby") return [details.stage && copy.rugbyStages[details.stage], details.round && fill(copy.roundNumber, { n: details.round }), details.group && `${copy.group} ${details.group}`].filter(Boolean).join(" · ") || null
  if (details?.kind === "volleyball") return volleyballChip(details, t)
  if (details?.kind === "basketball") return [details.stage && copy.basketballStages[details.stage], details.round && fill(copy.roundNumber, { n: details.round }), details.group && `${copy.group} ${details.group}`].filter(Boolean).join(" · ") || null
  if (details?.kind === "cricket") return [details.format && copy.cricketFormats[details.format], details.matchLabel, details.stage && copy.cricketStages[details.stage]].filter(Boolean).join(" · ") || null
  if (details?.kind === "tennis") return [tennisRoundText(details.round, t), details.gender && copy.gender[details.gender], details.format === "doubles" ? copy.tennisFormats.doubles : null].filter(Boolean).join(" · ") || null
  if (details?.kind === "motorsport") return [sessionText(details, t), details.className].filter(Boolean).join(" · ")
  if (details?.kind === "combat") return [details.discipline && copy.disciplines[details.discipline], details.bouts.length > 1 ? fill(copy.boutCount, { count: details.bouts.length }) : details.weightClass && weightClassText(details.weightClass, t)].filter(Boolean).join(" · ") || null
  return null
}

function cricketStats(score: Extract<EventScore, { kind: "innings" }>, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.ballsLeft, score.ballsLeft],
    [copy.method, score.method && t.event.dls],
    [copy.weather, score.rain && copy.rainAffected],
    [copy.reducedOvers, score.reducedOvers],
    [copy.revisedOvers, score.revisedOvers],
    [copy.target, score.target],
    [copy.playerOfMatch, score.playerOfMatch],
  ])
}

function raceStats(score: Extract<EventScore, { kind: "classification" }>, t: Dictionary): Fact[] {
  const copy = t.sportTerms
  return facts([
    [copy.pole, score.pole],
    [copy.fastestLap, score.fastestLap && [score.fastestLap.name, score.fastestLap.time].filter(Boolean).join(" · ")],
  ])
}

/** Result facts that do not fit the score table. Reveals the outcome. */
export function resultFacts(event: Pick<SportEvent, "score">, t: Dictionary): Fact[] {
  const { score } = event
  if (score.kind === "innings") return cricketStats(score, t)
  return score.kind === "classification" ? raceStats(score, t) : []
}

/** The tiebreak goes after the set: "7-6(4)". */
export function setScore(games: [number, number], tiebreak: number | null | undefined): string {
  return `${games[0]}-${games[1]}${tiebreak === null || tiebreak === undefined ? "" : `(${tiebreak})`}`
}

/** What happened in order, for sports with no running feed. Reveals the outcome. */
export function sportSteps(event: Pick<SportEvent, "score" | "details" | "participants">, t: Dictionary): string[] {
  const { score, details, participants } = event
  const copy = t.sportTerms
  if (score.kind === "innings") {
    const sides = [
      { name: participants[0]?.name, list: score.homeInnings, total: score.home },
      { name: participants[1]?.name, list: score.awayInnings, total: score.away },
    ]
    return [
      ...(details?.kind === "cricket" && details.toss ? [`${copy.toss}: ${fill(copy.tossChoice[details.toss.choice], { name: details.toss.side })}`] : []),
      ...sides.flatMap(({ name, list, total }) => {
        const text = inningsLine(list, total)
        return name && text ? [`${name}: ${text}${total?.overs ? ` (${fill(t.event.overs, { overs: total.overs })})` : ""}`] : []
      }),
    ]
  }
  if (score.kind === "sets") {
    const [first, second] = participants.map((participant) => score.lines.find((line) => line.name === participant.name))
    if (!first || !second) return []
    return first.games.map((games, index) => {
      const pair: [number, number] = [games, second.games[index]]
      return `${fill(t.event.set, { n: index + 1 })}: ${first.name} ${setScore(pair, score.tiebreaks?.[index])} ${second.name}`
    })
  }
  if (details?.kind === "tennis") return details.rubbers.map((rubber) => `${rubber.winner} ${copy.beat} ${rubber.loser}: ${rubber.games.map((games, index) => setScore(games, rubber.tiebreaks[index])).join(" ")}`)
  if (details?.kind === "combat") return details.bouts.flatMap((bout) => boutLine(bout, t) ?? [])
  return []
}

export function boutLine(bout: CombatBout, t: Dictionary): string | null {
  if (!bout.winner) return null
  const loser = bout.names.find((name) => name !== bout.winner)
  const how = [bout.method && t.event.methods[bout.method], bout.round ? fill(t.event.round, { round: bout.round }) : null, bout.time].filter(Boolean).join(", ")
  return `${bout.winner} ${t.sportTerms.beat} ${loser}${how ? `: ${how}` : ""}`
}
