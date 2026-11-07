// Team and player comparison, built only from what the feed reports. Each sport is read
// by its own score shape and worded in its own terms: a team with no finished games shows
// nothing rather than zeros, and a detail nobody published stays blank.

import { entrantsOf, INDIVIDUAL_SPORTS } from "./entrants"
import { decidedSide, setsWinner } from "./game-result"
import type { PlayerAdvanced, PlayerProfile } from "./player"
import { getPlayerForComparison, getStandings, getTeamFixtures, storedSportEvents, type StandingRow } from "./service"
import type { CombatMethod, CricketFormat, SportEvent, SportId } from "./types"

/** W, drawn, L, then cricket's tied and no result. */
export type FormResult = "W" | "D" | "L" | "T" | "N"

export interface SplitRecord {
  played: number
  wins: number
  draws: number
  losses: number
  /** Hockey: those of the losses that came after regulation. */
  overtimeLosses?: number
  ties: number
  noResults: number
  scored: number
  conceded: number
  /** Games with a figure on each side. A cricket result can come with no runs. */
  counted: number
}

export interface CricketFigures {
  byFormat: Partial<Record<CricketFormat, SplitRecord>>
  highest: number | null
  lowest: number | null
  winsByRuns: number
  winsByWickets: number
}

export interface EntrantFigures {
  tennis?: { straightSets: number; tiebreaks: number }
  combat?: { ko: number; submission: number; decision: number }
  racing?: { races: number; wins: number; podiums: number; best: number | null; average: number | null; points: number | null; retirements: number }
}

export interface TeamProfile extends EntrantFigures {
  name: string
  record: SplitRecord
  form: FormResult[]
  next: { id: string; title: string; startUTC: string | null } | null
  advanced?: {
    home: SplitRecord
    away: SplitRecord
    cleanSheets: number
    failedToScore: number
    overtimeGames: number
    cricket?: CricketFigures
    standing: { league: string | null; rank: number | null; points: number | null; difference: number | null } | null
  }
}

export interface Comparison {
  tier: "basic" | "advanced"
  sportId: SportId | null
  teams: [TeamProfile, TeamProfile]
  headToHead: { id: string; title: string; dateUTC: string | null; result: string }[]
  fetchedAt: string
}

const empty = (): SplitRecord => ({ played: 0, wins: 0, draws: 0, losses: 0, ties: 0, noResults: 0, scored: 0, conceded: 0, counted: 0 })

export interface TeamGame {
  event: SportEvent
  home: boolean
  scored: number | null
  conceded: number | null
  result: FormResult
}

const CRICKET_RESULT: Partial<Record<string, FormResult>> = { drawn: "D", tied: "T", "no-result": "N" }

/** One side's game, read by the score's own shape. Null when the source gives no result to read. */
export function readGame(name: string, event: SportEvent): Omit<TeamGame, "event"> | null {
  const { score } = event
  const side = event.participants.findIndex((participant) => participant.name === name)
  const home = side === 0
  if (score.kind === "team") {
    const decided = side === -1 ? null : decidedSide(event)
    if (!decided) return null
    const [scored, conceded] = home ? [score.home, score.away] : [score.away, score.home]
    return { home, scored, conceded, result: decided.winner === null ? "D" : decided.winner === side ? "W" : "L" }
  }
  if (score.kind === "innings") {
    if (side === -1) return null
    const decided = decidedSide(event)
    const stated = score.outcome ? CRICKET_RESULT[score.outcome] : undefined
    const result: FormResult | undefined = decided?.winner === null ? stated ?? "D" : decided ? (decided.winner === side ? "W" : "L") : stated
    if (!result) return null
    const [mine, theirs] = home ? [score.home, score.away] : [score.away, score.home]
    return { home, scored: mine?.runs ?? null, conceded: theirs?.runs ?? null, result }
  }
  if (score.kind === "sets") {
    const line = score.lines.findIndex((row) => row.name === name)
    const winner = setsWinner(score)
    if (line === -1 || !winner) return null
    const [mine, theirs] = [score.lines[line].games, score.lines[1 - line]?.games ?? []]
    const both = mine.flatMap((games, index) => (theirs[index] === undefined ? [] : [[games, theirs[index]] as const]))
    const won = both.filter(([own, other]) => own > other).length
    const lost = both.filter(([own, other]) => other > own).length
    return { home: line === 0, scored: won, conceded: lost, result: winner === name ? "W" : "L" }
  }
  if (score.kind === "combat") return side === -1 ? null : { home, scored: null, conceded: null, result: score.winner === name ? "W" : "L" }
  return null
}

/** Newest first. Only finished games with a result the sport can state count. */
export function teamGames(name: string, events: SportEvent[]): TeamGame[] {
  return events
    .flatMap((event) => {
      // An abandoned cricket match is a result of its own, and it counts as played.
      if (event.status === "abandoned" && event.sportId === "cricket") {
        const side = event.participants.findIndex((participant) => participant.name === name)
        return side === -1 ? [] : [{ event, home: side === 0, scored: null, conceded: null, result: "N" as const }]
      }
      if (event.status !== "finished" || (event.details as { stage?: string | null } | undefined)?.stage === "preseason") return []
      const game = readGame(name, event)
      return game ? [{ ...game, event }] : []
    })
    .sort((a, b) => (b.event.scheduledStartUTC ?? "").localeCompare(a.event.scheduledStartUTC ?? ""))
}

const lostLate = ({ event, result }: { event?: SportEvent; result: FormResult }) => result === "L" && event?.sportId === "ice-hockey" && (event.conclusion === "overtime" || event.conclusion === "shootout")

function tally(games: (Pick<TeamGame, "scored" | "conceded" | "result"> & { event?: SportEvent })[]): SplitRecord {
  const record = empty()
  for (const game of games) {
    record.played += 1
    if (game.scored !== null && game.conceded !== null) {
      record.counted += 1
      record.scored += game.scored
      record.conceded += game.conceded
    }
    if (game.result === "W") record.wins += 1
    else if (game.result === "L") {
      record.losses += 1
      if (lostLate(game)) record.overtimeLosses = (record.overtimeLosses ?? 0) + 1
    }
    else if (game.result === "T") record.ties += 1
    else if (game.result === "N") record.noResults += 1
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

function cricketFigures(name: string, games: TeamGame[]): CricketFigures | undefined {
  const played = games.filter((game) => game.event.score.kind === "innings")
  if (played.length === 0) return undefined
  const byFormat: CricketFigures["byFormat"] = {}
  const formats = new Set(played.flatMap((game) => (game.event.details?.kind === "cricket" && game.event.details.format ? [game.event.details.format] : [])))
  for (const format of formats) byFormat[format] = tally(played.filter((game) => game.event.details?.kind === "cricket" && game.event.details.format === format))
  const totals = played.flatMap((game) => (game.scored === null ? [] : [game.scored]))
  const wonBy = (unit: "runs" | "wickets") => played.filter((game) => game.event.score.kind === "innings" && game.event.score.winner === name && game.event.score.margin?.unit === unit).length
  return { byFormat, highest: totals.length ? Math.max(...totals) : null, lowest: totals.length ? Math.min(...totals) : null, winsByRuns: wonBy("runs"), winsByWickets: wonBy("wickets") }
}

export function advancedFigures(name: string, recent: SportEvent[]): Omit<NonNullable<TeamProfile["advanced"]>, "standing"> {
  const games = teamGames(name, recent)
  const cricket = cricketFigures(name, games)
  return {
    home: tally(games.filter((game) => game.home)),
    away: tally(games.filter((game) => !game.home)),
    cleanSheets: games.filter((game) => game.conceded === 0).length,
    failedToScore: games.filter((game) => game.scored === 0).length,
    overtimeGames: games.filter((game) => game.event.conclusion === "overtime" || game.event.conclusion === "shootout" || game.event.conclusion === "extra-time").length,
    ...(cricket ? { cricket } : {}),
  }
}

/** What finished, in the sport's own form: "2-1", "India 245/8, Pakistan 240", "6-4 6-3". */
export function resultLine(event: SportEvent): string | null {
  const { score } = event
  if (score.kind === "team") return `${score.home}-${score.away}`
  if (score.kind === "innings") {
    const side = (name: string | undefined, innings: typeof score.home) => (innings ? `${name ?? ""} ${innings.runs}${innings.wickets === null || innings.wickets === 10 ? "" : `/${innings.wickets}`}`.trim() : null)
    return [side(event.participants[0]?.name, score.home), side(event.participants[1]?.name, score.away)].filter(Boolean).join(", ") || score.winner
  }
  if (score.kind === "sets") {
    const [first, second] = score.lines
    return first && second ? first.games.flatMap((games, index) => (second.games[index] === undefined ? [] : [`${games}-${second.games[index]}`])).join(" ") || score.winner : score.winner
  }
  return score.kind === "combat" ? score.winner : null
}

/** Games between these two inside either side's recent results. */
export function headToHead(first: string, second: string, events: SportEvent[]): Comparison["headToHead"] {
  const seen = new Set<string>()
  return events.flatMap((event) => {
    const names = event.participants.map((participant) => participant.name)
    const result = resultLine(event)
    // A golden set is a tiebreak in points, not a match of its own.
    const golden = event.details?.kind === "volleyball" && event.details.goldenSet
    if (golden || seen.has(event.id) || !result || event.status !== "finished" || !names.includes(first) || !names.includes(second)) return []
    seen.add(event.id)
    return [{ id: event.id, title: names.join(" v "), dateUTC: event.scheduledStartUTC, result }]
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

const KNOCKOUTS = new Set<CombatMethod>(["ko", "tko"])
const DECISIONS = new Set<CombatMethod>(["unanimous-decision", "split-decision", "majority-decision", "decision"])

/** A fight card holds many bouts, so each one the name fought counts as a game. */
function combatGames(name: string, events: SportEvent[]): { result: FormResult; method: CombatMethod | null }[] {
  return events.flatMap((event) => {
    if (event.status !== "finished") return []
    if (event.details?.kind === "combat" && event.details.bouts.length > 0) {
      return event.details.bouts.flatMap((bout) => {
        if (!bout.names.includes(name)) return []
        // A draw counts as one; a no contest is a bout with no result for either side.
        if (bout.outcome === "draw") return [{ result: "D" as FormResult, method: null }]
        return bout.winner ? [{ result: (bout.winner === name ? "W" : "L") as FormResult, method: bout.method }] : []
      })
    }
    return event.score.kind === "combat" && event.participants.some((item) => item.name === name) ? [{ result: (event.score.winner === name ? "W" : "L") as FormResult, method: event.score.method }] : []
  })
}

function racingFigures(name: string, events: SportEvent[]): EntrantFigures["racing"] {
  const races = events.filter((event) => event.status === "finished" && event.details?.kind === "motorsport" && event.details.session === "race" && event.score.kind === "classification")
  const places: number[] = []
  // Most sources print no points, so a total is shown only when a race of this entrant's had them.
  let points: number | null = null
  let retirements = 0
  let entered = 0
  for (const { score } of races) {
    if (score.kind !== "classification") continue
    const entry = score.entries.find((item) => item.name === name)
    if (entry) {
      entered += 1
      places.push(entry.position)
      if (typeof entry.points === "number") points = (points ?? 0) + entry.points
    } else if (score.out?.some((item) => item.name === name)) {
      entered += 1
      retirements += 1
    }
  }
  return {
    races: entered,
    wins: places.filter((place) => place === 1).length,
    podiums: places.filter((place) => place <= 3).length,
    best: places.length ? Math.min(...places) : null,
    average: places.length ? places.reduce((total, place) => total + place, 0) / places.length : null,
    points,
    retirements,
  }
}

export function entrantProfile(name: string, sport: SportId, events: SportEvent[], now: Date = new Date()): TeamProfile {
  const own = events.filter((event) => entrantsOf(event).includes(name))
  const coming = own.filter((event) => event.status === "scheduled" && Date.parse(event.scheduledStartUTC ?? "") > now.getTime()).sort((a, b) => (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? ""))
  const base = basicProfile(name, own, coming)
  if (sport === "combat-sports") {
    const bouts = combatGames(name, own)
    const wins = bouts.filter((bout) => bout.result === "W")
    const by = (test: (method: CombatMethod) => boolean) => wins.filter((bout) => bout.method && test(bout.method)).length
    return { ...base, record: tally(bouts.map((bout) => ({ scored: null, conceded: null, result: bout.result }))), form: bouts.map((bout) => bout.result).reverse(), combat: { ko: by((method) => KNOCKOUTS.has(method)), submission: by((method) => method === "submission"), decision: by((method) => DECISIONS.has(method)) } }
  }
  if (sport === "motorsport") return { ...base, racing: racingFigures(name, own) }
  const wins = teamGames(name, own).filter((game) => game.result === "W")
  const tiebreaks = own.reduce((total, event) => {
    if (event.score.kind !== "sets" || event.status !== "finished") return total
    const [first, second] = event.score.lines
    if (!first || !second) return total
    const mine = first.name === name ? first : second.name === name ? second : null
    const theirs = mine === first ? second : first
    return total + (mine ? mine.games.filter((games, index) => games === 7 && theirs.games[index] === 6).length : 0)
  }, 0)
  return { ...base, tennis: { straightSets: wins.filter((game) => game.conceded === 0).length, tiebreaks } }
}

async function compareEntrants(first: string, second: string, sport: SportId, tier: Comparison["tier"]): Promise<Comparison> {
  const events = await storedSportEvents(sport)
  const names = new Map(events.flatMap((event) => entrantsOf(event)).map((name) => [name.toLowerCase(), name]))
  const find = (name: string) => {
    const known = names.get(name.trim().toLowerCase())
    if (!known) throw new TeamNotFound(name)
    return known
  }
  const [one, two] = [find(first), find(second)]
  return {
    tier,
    sportId: sport,
    teams: [entrantProfile(one, sport, events), entrantProfile(two, sport, events)],
    headToHead: tier === "advanced" ? headToHead(one, two, events) : [],
    fetchedAt: new Date().toISOString(),
  }
}

export async function compareTeams(first: string, second: string, sport: SportId | undefined, tier: Comparison["tier"]): Promise<Comparison> {
  if (sport && INDIVIDUAL_SPORTS.has(sport)) return compareEntrants(first, second, sport, tier)
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
