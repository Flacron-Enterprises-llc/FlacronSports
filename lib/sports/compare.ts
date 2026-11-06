// Team and player comparison, built only from what the feed reports. A team with no
// finished games shows nothing rather than zeros, and a detail nobody published stays blank.

import type { PlayerAdvanced, PlayerProfile } from "./player"
import { getPlayerForComparison, getStandings, getTeamFixtures, type StandingRow } from "./service"
import type { SportEvent, SportId } from "./types"

export type FormResult = "W" | "D" | "L"

export interface SplitRecord {
  played: number
  wins: number
  draws: number
  losses: number
  scored: number
  conceded: number
}

export interface TeamProfile {
  name: string
  record: SplitRecord
  form: FormResult[]
  next: { id: string; title: string; startUTC: string | null } | null
  advanced?: {
    home: SplitRecord
    away: SplitRecord
    cleanSheets: number
    failedToScore: number
    standing: { league: string | null; rank: number | null; points: number | null; difference: number | null } | null
  }
}

export interface Comparison {
  tier: "basic" | "advanced"
  sportId: SportId | null
  teams: [TeamProfile, TeamProfile]
  headToHead: { id: string; title: string; dateUTC: string | null; home: number; away: number }[]
  fetchedAt: string
}

const empty = (): SplitRecord => ({ played: 0, wins: 0, draws: 0, losses: 0, scored: 0, conceded: 0 })

interface TeamGame {
  event: SportEvent
  home: boolean
  scored: number
  conceded: number
  result: FormResult
}

/** Newest first. Only finished games with a two-sided score count. */
export function teamGames(name: string, events: SportEvent[]): TeamGame[] {
  return events
    .flatMap((event) => {
      if (event.status !== "finished" || event.score.kind !== "team") return []
      const side = event.participants.findIndex((participant) => participant.name === name)
      if (side === -1) return []
      const home = side === 0
      const scored = home ? event.score.home : event.score.away
      const conceded = home ? event.score.away : event.score.home
      return [{ event, home, scored, conceded, result: (scored > conceded ? "W" : scored < conceded ? "L" : "D") as FormResult }]
    })
    .sort((a, b) => (b.event.scheduledStartUTC ?? "").localeCompare(a.event.scheduledStartUTC ?? ""))
}

function tally(games: TeamGame[]): SplitRecord {
  const record = empty()
  for (const game of games) {
    record.played += 1
    record.scored += game.scored
    record.conceded += game.conceded
    if (game.result === "W") record.wins += 1
    else if (game.result === "L") record.losses += 1
    else record.draws += 1
  }
  return record
}

export function basicProfile(name: string, recent: SportEvent[], upcoming: SportEvent[]): TeamProfile {
  const games = teamGames(name, recent)
  const coming = upcoming[0]
  return {
    name,
    record: tally(games),
    form: games.map((game) => game.result),
    next: coming ? { id: coming.id, title: coming.participants.map((participant) => participant.name).join(" v "), startUTC: coming.scheduledStartUTC } : null,
  }
}

export function advancedFigures(name: string, recent: SportEvent[]): Omit<NonNullable<TeamProfile["advanced"]>, "standing"> {
  const games = teamGames(name, recent)
  return {
    home: tally(games.filter((game) => game.home)),
    away: tally(games.filter((game) => !game.home)),
    cleanSheets: games.filter((game) => game.conceded === 0).length,
    failedToScore: games.filter((game) => game.scored === 0).length,
  }
}

/** Games between these two teams inside either side's recent results. */
export function headToHead(first: string, second: string, events: SportEvent[]): Comparison["headToHead"] {
  const seen = new Set<string>()
  return events.flatMap((event) => {
    const names = event.participants.map((participant) => participant.name)
    if (seen.has(event.id) || event.score.kind !== "team" || event.status !== "finished" || !names.includes(first) || !names.includes(second)) return []
    seen.add(event.id)
    return [{ id: event.id, title: names.join(" v "), dateUTC: event.scheduledStartUTC, home: event.score.home, away: event.score.away }]
  })
}

function findRow(rows: StandingRow[], name: string): StandingRow | undefined {
  return rows.find((row) => row.team.toLowerCase() === name.toLowerCase())
}

/** Cups have no table, so the most recent league that lists the team is the one used. */
async function standingFor(name: string, recent: SportEvent[]): Promise<NonNullable<TeamProfile["advanced"]>["standing"]> {
  const leagues = [...new Set(recent.flatMap((event) => (event.competition.id ? [event.competition.id] : [])))].slice(0, 3)
  for (const league of leagues) {
    const table = await getStandings(league)
    const row = findRow(table.rows, name)
    if (row) return { league: table.league, rank: row.rank, points: row.points, difference: row.difference }
  }
  return null
}

export class TeamNotFound extends Error {
  constructor(public readonly name: string) {
    super("Team not found")
  }
}

export async function compareTeams(first: string, second: string, sport: SportId | undefined, tier: Comparison["tier"]): Promise<Comparison> {
  const [one, two] = await Promise.all([getTeamFixtures(first, sport), getTeamFixtures(second, sport)])
  if (!one.team) throw new TeamNotFound(first)
  if (!two.team) throw new TeamNotFound(second)

  const profile = async (name: string, recent: SportEvent[], upcoming: SportEvent[]): Promise<TeamProfile> => {
    const base = basicProfile(name, recent, upcoming)
    if (tier === "basic") return base
    return { ...base, advanced: { ...advancedFigures(name, recent), standing: await standingFor(name, recent) } }
  }

  return {
    tier,
    sportId: one.team.sportId,
    teams: [await profile(one.team.name, one.recent, one.upcoming), await profile(two.team.name, two.recent, two.upcoming)],
    headToHead: tier === "advanced" ? headToHead(one.team.name, two.team.name, [...one.recent, ...two.recent]) : [],
    fetchedAt: new Date().toISOString(),
  }
}

export interface ComparedPlayer {
  profile: PlayerProfile
  /** Absent below Premium, so the reply itself holds nothing a lower plan cannot see. */
  advanced?: PlayerAdvanced
}

export interface PlayerComparison {
  tier: Comparison["tier"]
  players: [ComparedPlayer, ComparedPlayer]
  fetchedAt: string
}

export class PlayerNotFound extends Error {
  constructor(public readonly id: string) {
    super("Player not found")
  }
}

export async function comparePlayers(first: string, second: string, tier: Comparison["tier"]): Promise<PlayerComparison> {
  const [one, two] = await Promise.all([getPlayerForComparison(first), getPlayerForComparison(second)])
  if (!one) throw new PlayerNotFound(first)
  if (!two) throw new PlayerNotFound(second)
  const side = ({ profile, advanced }: NonNullable<typeof one>): ComparedPlayer => (tier === "advanced" ? { profile, advanced } : { profile })
  return { tier, players: [side(one), side(two)], fetchedAt: new Date().toISOString() }
}
