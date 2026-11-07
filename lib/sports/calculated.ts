// League tables worked out from finished games, for sports whose feed never fills the
// table call. Field inventory, 2026-11-07: empty for every league in basketball, ice
// hockey, American football, baseball, rugby, volleyball and cricket. These are not
// official tables, so nothing here guesses at league points, conferences or tiebreakers.

import { decidedSide } from "./game-result"
import type { StandingRow } from "./service"
import { normalizeEvent, type RawEvent } from "./thesportsdb"
import type { SportEvent, SportId } from "./types"

export type CalculatedUnit = "points" | "goals" | "sets" | "runs" | "baseball-runs"

const UNITS: Partial<Record<SportId, CalculatedUnit>> = {
  basketball: "points",
  "american-football": "points",
  baseball: "baseball-runs",
  "ice-hockey": "goals",
  volleyball: "sets",
  rugby: "points",
  cricket: "runs",
}

/** These sports read by win percentage, and the others by their own record. */
const WIN_PERCENT = new Set<SportId>(["basketball", "american-football", "baseball"])
/** A draw is part of these sports' record, so the column stays even when none has happened. */
const DRAW_COLUMN = new Set<SportId>(["rugby", "cricket"])

export const calculatesTable = (sportId: SportId): boolean => sportId in UNITS

const LAST_LEAGUE_ROUND = 99
/** The source's code for a preseason game, in every sport checked. Other codes of 100 and up are playoff rounds. */
const PRESEASON_ROUND = 500

const EXHIBITION = /\b(?:all[- ]?stars?|friendl(?:y|ies)|pre-?season|exhibition)\b/i

// Nothing a league table can say: names that are only ever a cup, a one-off or a set of
// unrelated series. College sports stay out too: their teams belong to conferences, and a
// season can pass the 3,000 rows the source returns. Other group stages are judged by their games.
const NEVER_A_TABLE = /^_|(?<!currie )\bcup\b|\bcopa\b|\bcoupe\b|\bsupercup\b|\bsupercopa\b|\bncaa\b|\ball[- ]?stars?\b|\bfriendlies\b|\bseries$|\bclassic\b|\bworld club challenge\b|\bstate of origin\b|\blions tours\b|\bsummer league\b|\bolympics\b|\bcommonwealth games\b|\basian games\b/i

// Spring exhibition games these leagues file like any other, by league id, with the month
// and day the regular season has always started after. Checked on the 2025 and 2026 seasons.
const EXHIBITIONS_UNTIL: Record<string, string> = { "4591": "03-26", "4830": "03-21" }

/** False saves a page from asking for a season that cannot hold a league table. */
export const canHaveTable = (sportId: SportId, league: string): boolean => calculatesTable(sportId) && !NEVER_A_TABLE.test(league)

const sideOf = (id: string | null | undefined, name: string | null | undefined) => id || name?.trim() || ""

/** How many games most teams have on the schedule. In a tie the shorter one: playoffs only ever add games. */
function scheduleLength(rows: RawEvent[]): number {
  const totals = new Map<string, number>()
  for (const raw of rows) for (const side of [sideOf(raw.idHomeTeam, raw.strHomeTeam), sideOf(raw.idAwayTeam, raw.strAwayTeam)]) totals.set(side, (totals.get(side) ?? 0) + 1)
  const teams = new Map<number, number>()
  for (const total of totals.values()) teams.set(total, (teams.get(total) ?? 0) + 1)
  return [...teams.entries()].sort(([lengthA, a], [lengthB, b]) => b - a || lengthA - lengthB)[0]?.[0] ?? 0
}

/**
 * The games a league table counts. Round codes of 100 and up are playoffs or preseason, but
 * the others do not settle it: round 0 is every game of a season not yet numbered, yet in
 * a numbered one it holds the PlusLiga playoffs, and the NHL files its first playoff round
 * in round 16 while the SHL numbers its playoffs straight after the league rounds. What does
 * hold is the schedule. Unplayed games count towards it, so a team's games in hand stay in,
 * and no team plays past its full schedule in a league phase.
 */
export function leagueGames(rows: RawEvent[], leagueId: string, league: string): RawEvent[] {
  const exhibition = EXHIBITION.test(league)
  const own = rows.filter((raw) => (!raw.idLeague || raw.idLeague === leagueId) && (exhibition || !EXHIBITION.test(`${raw.strEvent ?? ""} ${raw.strGroup ?? ""}`)))
  const roundOf = (raw: RawEvent) => Number(raw.intRound) || 0
  if (own.length > 0 && own.every((raw) => roundOf(raw) === PRESEASON_ROUND)) return own

  const opens = EXHIBITIONS_UNTIL[leagueId] ?? ""
  const phase = own.filter((raw) => roundOf(raw) <= LAST_LEAGUE_ROUND && (raw.dateEvent ?? "").slice(5) >= opens).sort((a, b) => (a.dateEvent ?? "").localeCompare(b.dateEvent ?? ""))
  const full = scheduleLength(phase)
  const reached = new Map<string, number>()
  return phase.filter((raw) => {
    const sides = [sideOf(raw.idHomeTeam, raw.strHomeTeam), sideOf(raw.idAwayTeam, raw.strAwayTeam)]
    if (sides.some((side) => (reached.get(side) ?? 0) >= full)) return false
    for (const side of sides) reached.set(side, (reached.get(side) ?? 0) + 1)
    return true
  })
}

interface Game {
  sides: [{ key: string; name: string }, { key: string; name: string }]
  /** Null when the source gives no total for this game. */
  scores: [number, number] | null
  winner: 0 | 1 | null
  /** Settled after regulation, which only hockey needs. */
  extended: boolean
  date: string
}

const VOLLEYBALL_MOST_SETS = 3
/** Null for anything but a finished game with a result this sport can really have. */
function readGame(raw: RawEvent, sportId: SportId, now: Date): Game | null {
  const [home, away] = [raw.strHomeTeam?.trim(), raw.strAwayTeam?.trim()]
  const date = raw.dateEvent?.trim()
  if (!home || !away || !date || date > now.toISOString().slice(0, 10)) return null
  // The postponed flag stays on a game after it is played, on 23 MLB games in 2025 alone.
  const event = normalizeEvent({ ...raw, strPostponed: null }, sportId, now)
  if (event.status !== "finished") return null
  const sides: Game["sides"] = [{ key: sideOf(raw.idHomeTeam, home), name: home }, { key: sideOf(raw.idAwayTeam, away), name: away }]

  if (event.score.kind === "innings") {
    const decided = decidedSide(event, { guessCricket: true })
    if (!decided) return null
    const { home: first, away: second } = event.score
    return { sides, scores: first && second ? [first.runs, second.runs] : null, winner: decided.winner, extended: false, date }
  }
  if (event.score.kind !== "team") return null
  const scores: [number, number] = [event.score.home, event.score.away]
  // A finished game left at nil-nil is a result that was never entered.
  if (scores[0] === 0 && scores[1] === 0) return null
  if (sportId === "volleyball" && (scores[0] === scores[1] || Math.max(...scores) > VOLLEYBALL_MOST_SETS)) return null
  const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { sides, scores, winner, extended: event.conclusion === "overtime" || event.conclusion === "shootout", date }
}

/** Separate pools share no games, and one list would rank teams that never met anyone in common. */
function connected(games: Game[], keys: string[]): boolean {
  const links = new Map(keys.map((key) => [key, new Set<string>()]))
  for (const { sides: [home, away] } of games) {
    links.get(home.key)?.add(away.key)
    links.get(away.key)?.add(home.key)
  }
  const reached = new Set([keys[0]])
  const waiting = [keys[0]]
  while (waiting.length > 0) {
    for (const next of links.get(waiting.pop() as string) ?? []) {
      if (reached.has(next)) continue
      reached.add(next)
      waiting.push(next)
    }
  }
  return reached.size === keys.length
}

const FEWEST_TEAMS = 4
/** Each game involves two teams, so this is two games a team on average. Fewer says nothing. */
const FEWEST_GAMES_PER_TEAM = 1
/** A league's teams stay close in games played. A knockout's do not, as losers stop early. */
const LOWEST_PLAYED_SHARE = 0.5
/** Below this the source's overtime marks are too patchy to call the other losses regulation. */
const LOWEST_EXTENDED_SHARE = 0.05

export interface CalculatedTable {
  rows: StandingRow[]
  games: number
  latestGame: string
  unit: CalculatedUnit
}

interface Tally {
  name: string
  played: number
  won: number
  drawn: number
  lost: number
  extendedLosses: number
  scoredFor: number
  scoredAgainst: number
}

const ratio = ({ won, drawn, played }: Tally) => (won + drawn / 2) / played
/** KBO, NPB and CPBL leave a tie out of the percentage: KT's 90-49-5 in 2026 is .647. */
const baseballPercent = ({ won, lost }: Tally) => (won + lost ? won / (won + lost) : 0)

/** Null when the season has too few games or is not a league: the page then says so. */
export function calculateTable(rows: RawEvent[], sportId: SportId, leagueId: string, league: string, now: Date = new Date()): CalculatedTable | null {
  const unit = UNITS[sportId]
  if (!unit) return null
  const games = leagueGames(rows, leagueId, league).flatMap((raw) => readGame(raw, sportId, now) ?? [])
  const tallies = new Map<string, Tally>()
  for (const game of games) {
    game.sides.forEach((side, index) => {
      const tally = tallies.get(side.key) ?? { name: side.name, played: 0, won: 0, drawn: 0, lost: 0, extendedLosses: 0, scoredFor: 0, scoredAgainst: 0 }
      tally.played += 1
      if (game.winner === null) tally.drawn += 1
      else if (game.winner === index) tally.won += 1
      else if (game.extended) tally.extendedLosses += 1
      else tally.lost += 1
      tally.scoredFor += game.scores?.[index] ?? 0
      tally.scoredAgainst += game.scores?.[1 - index] ?? 0
      tallies.set(side.key, tally)
    })
  }

  const teams = [...tallies.values()]
  const played = teams.map((team) => team.played)
  if (teams.length < FEWEST_TEAMS || games.length < teams.length * FEWEST_GAMES_PER_TEAM) return null
  if (Math.min(...played) < Math.max(...played) * LOWEST_PLAYED_SHARE) return null
  if (!connected(games, [...tallies.keys()])) return null

  // A total missing from one game would make every total on the table wrong.
  const totals = games.every((game) => game.scores)
  const splitLosses = sportId === "ice-hockey" && games.filter((game) => game.extended).length >= games.length * LOWEST_EXTENDED_SHARE
  const showDraws = DRAW_COLUMN.has(sportId) || teams.some((team) => team.drawn > 0)
  const difference = (team: Tally) => (totals ? team.scoredFor - team.scoredAgainst : 0)
  // Every hockey league gives a point for a loss after regulation, so it ranks above one in regulation.
  const standing = (team: Tally) => (splitLosses ? (team.won + (team.drawn + team.extendedLosses) / 2) / team.played : sportId === "baseball" ? baseballPercent(team) : ratio(team))
  teams.sort((a, b) => standing(b) - standing(a) || difference(b) - difference(a) || b.scoredFor - a.scoredFor || a.name.localeCompare(b.name))

  const ranked: StandingRow[] = []
  teams.forEach((team, index) => {
    const before = teams[index - 1]
    const level = before && standing(before) === standing(team) && difference(before) === difference(team)
    ranked.push({
      rank: level ? (ranked[index - 1].rank as number) : index + 1,
      team: team.name,
      played: team.played,
      won: team.won,
      drawn: showDraws ? team.drawn : null,
      lost: splitLosses ? team.lost : team.lost + team.extendedLosses,
      scoredFor: totals ? team.scoredFor : null,
      scoredAgainst: totals ? team.scoredAgainst : null,
      difference: totals && (WIN_PERCENT.has(sportId) || sportId === "rugby") ? difference(team) : null,
      points: null,
      form: null,
      zone: null,
      ...(WIN_PERCENT.has(sportId) ? { winPercent: Math.round((sportId === "baseball" ? baseballPercent(team) : ratio(team)) * 1000) / 1000 } : {}),
      ...(splitLosses ? { overtimeLosses: team.extendedLosses } : {}),
    })
  })
  return { rows: ranked, games: games.length, latestGame: games.map((game) => game.date).sort().at(-1) as string, unit }
}
