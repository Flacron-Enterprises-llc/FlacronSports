// Free sport-specific predictions (spec section 5). No wagers, deposits or prizes:
// points exist only for the leaderboard. Rules are published in the UI from i18n.

import { ApiError } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"
import { eventTitle, isDuel } from "@/lib/sports/presentation"
import type { SportEvent, SportId } from "@/lib/sports/types"
import { badgesFor } from "./badges"
import { assertNotSanctioned, readSanction } from "./chat"
import { requireAccepted } from "./gate"

export const SCORING_VERSION = 1
// Winner and podium values can never add up to `exact`: settlement counts exact
// scores by comparing against it, so podium points stay even and winner stays 3.
export const POINTS = { exact: 5, outcome: 2, winner: 3, podiumExact: 4, podiumPlaced: 2 } as const
export const PODIUM_SIZE = 3

const TEAM_SCORE_SPORTS = new Set<SportId>(["football", "basketball", "american-football", "baseball", "ice-hockey", "rugby", "volleyball"])
const MAX_SCORE = 300
const LEADERBOARD_SIZE = 50
const DAY = 86_400_000
// The published limits after which an event with no confirmed result is void.
export const NO_RESULT_VOID_DAYS = 7
export const POSTPONED_VOID_DAYS = 30
const NOT_A_RACE = /\b(practice|qualifying|sprint|shootout|warm.?up)\b/i
// The feed has one number per side for a test, so its result is never stated.
const TEST_CRICKET = /\btest\b/i

export type PredictionKind = "score" | "winner" | "podium"
export type PredictionStatus = "open" | "locked" | "settled" | "void"

/** The game as it read when the pick was made, so listing picks costs no provider calls. */
export interface PredictionGame {
  title: string
  home: string | null
  away: string | null
}

export interface Prediction {
  uid: string
  displayName: string
  matchId: string
  /** Absent on entries made before games were stored with the pick. */
  game?: PredictionGame
  /** Absent on entries made when only scores could be predicted. */
  kind?: PredictionKind
  home?: number
  away?: number
  winner?: string
  podium?: string[]
  createdAtUTC: string
  lockedAtUTC: string
  scoringVersion: number
  settled: boolean
  settledKey: string | null
  voided: boolean
  points: number
}

interface PointsDoc {
  uid: string
  displayName: string
  points: number
  exact: number
}

const predictionPath = (matchId: string, uid: string) => `predictions/${matchId}_${uid}`
const pointsPath = (uid: string) => `prediction_points/${uid}`

export function supportsScorePrediction(event: SportEvent): boolean {
  return event.participantType === "team" && event.participants.length === 2 && TEAM_SCORE_SPORTS.has(event.sportId)
}

/** Which pick an event takes, or null when the feed could not settle one. */
export function predictionKind(event: SportEvent): PredictionKind | null {
  if (supportsScorePrediction(event)) return "score"
  if (event.sportId === "motorsport") return event.eventType === "session" && event.eventName && !NOT_A_RACE.test(event.eventName) ? "podium" : null
  if (event.participants.length !== 2 || event.participants.some((participant) => participant.name === "TBD")) return null
  if (event.sportId === "tennis" || event.sportId === "combat-sports") return "winner"
  return event.sportId === "cricket" && !TEST_CRICKET.test(event.competition.name) ? "winner" : null
}

/** A race lists nobody until it is over, so the field comes from the competition's last classified session. */
export function predictionEntrants(event: SportEvent, recent: (leagueId: string, sportId: SportId) => Promise<string[]>): Promise<string[]> {
  if (predictionKind(event) !== "podium" || !event.competition.id) return Promise.resolve([])
  return recent(event.competition.id, event.sportId).catch(() => {
    throw new ApiError(503, "feed_unavailable", "Race data is temporarily unavailable")
  })
}

/** A date-only event has no official start to lock at, so it stays closed until it gets one. */
export function predictionOpen(event: SportEvent, now: Date): boolean {
  const kickoff = event.scheduledStartUTC ? Date.parse(event.scheduledStartUTC) : Number.NaN
  return event.status === "scheduled" && !event.dateOnly && !Number.isNaN(kickoff) && now.getTime() < kickoff
}

export function gameOf(event: SportEvent): PredictionGame {
  const [home, away] = isDuel(event) ? event.participants.map((participant) => participant.name) : [null, null]
  return { title: eventTitle(event), home, away }
}

function validScore(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SCORE
}

export interface PickInput {
  home?: unknown
  away?: unknown
  winner?: unknown
  podium?: unknown
  /** The field a podium is chosen from, from the server's own lookup. */
  entrants?: string[]
}

function readPick(kind: PredictionKind, event: SportEvent, input: PickInput): Pick<Prediction, "home" | "away" | "winner" | "podium"> {
  if (kind === "score") {
    if (!validScore(input.home) || !validScore(input.away)) throw new ApiError(400, "invalid_score", "Enter a valid score")
    return { home: input.home, away: input.away }
  }
  if (kind === "winner") {
    const winner = event.participants.find((participant) => participant.name === input.winner)?.name
    if (!winner) throw new ApiError(400, "invalid_pick", "Choose who will win")
    return { winner }
  }
  const entrants = input.entrants ?? []
  if (entrants.length < PODIUM_SIZE) throw new ApiError(422, "not_supported", "Podium picks are not available for this race")
  const podium = input.podium
  if (!Array.isArray(podium) || podium.length !== PODIUM_SIZE || new Set(podium).size !== PODIUM_SIZE || !podium.every((name) => entrants.includes(name))) {
    throw new ApiError(400, "invalid_pick", "Choose three different entrants")
  }
  return { podium: podium as string[] }
}

/** The event comes from the server's own lookup; a client-sent kickoff is never read. */
export async function submitPrediction(
  db: DocDb,
  input: { uid: string; displayName: string; event: SportEvent } & PickInput,
  now: Date,
): Promise<Prediction> {
  const { uid, displayName, event } = input
  const kind = predictionKind(event)
  if (!kind) throw new ApiError(422, "not_supported", "Predictions are not available for this event")
  const pick = readPick(kind, event, input)

  if (!predictionOpen(event, now)) throw new ApiError(409, "prediction_locked", "Predictions are locked for this match")
  const kickoff = Date.parse(event.scheduledStartUTC as string)

  return db.transaction(async (tx) => {
    const existing = await tx.get<Prediction>(predictionPath(event.id, uid))
    const sanction = await readSanction(tx, uid)
    await requireAccepted(tx, uid)
    assertNotSanctioned(sanction, now, "participate")
    if (existing) throw new ApiError(409, "duplicate_prediction", "You already predicted this match")

    const prediction: Prediction = {
      uid, displayName, matchId: event.id, game: gameOf(event), kind, ...pick,
      createdAtUTC: now.toISOString(),
      lockedAtUTC: new Date(kickoff).toISOString(),
      scoringVersion: SCORING_VERSION,
      settled: false,
      settledKey: null,
      voided: false,
      points: 0,
    }
    tx.set(predictionPath(event.id, uid), prediction)
    return prediction
  })
}

export function scorePrediction(prediction: { home: number; away: number }, result: { home: number; away: number }): number {
  if (prediction.home === result.home && prediction.away === result.away) return POINTS.exact
  return Math.sign(prediction.home - prediction.away) === Math.sign(result.home - result.away) ? POINTS.outcome : 0
}

const nameKey = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase()

export function scoreWinner(pick: string, winner: string): number {
  return nameKey(pick) === nameKey(winner) ? POINTS.winner : 0
}

/** Each entrant earns on their own, so a podium needs no all-or-nothing bonus. */
export function scorePodium(picks: string[], result: string[]): number {
  const finishers = result.map(nameKey)
  return picks.map(nameKey).reduce((total, name, index) => {
    if (finishers[index] === name) return total + POINTS.podiumExact
    return finishers.includes(name) ? total + POINTS.podiumPlaced : total
  }, 0)
}

type Settlement = { voided: boolean; points(prediction: Prediction): number; key: string }

/** A retirement decides a tennis match: the player left standing is the winner. */
function winnerOf(event: SportEvent): string | null {
  const { score } = event
  if (score.kind === "combat" || score.kind === "innings") return score.winner
  if (score.kind !== "sets") return null
  return score.winner ?? (score.retired ? event.participants.find((participant) => participant.name !== score.retired)?.name ?? null : null)
}

function resultSettlement(event: SportEvent, kind: PredictionKind | null): Settlement | null {
  const version = `v${SCORING_VERSION}`
  if (kind === "score" && event.score.kind === "team") {
    const result = { home: event.score.home, away: event.score.away }
    return { voided: false, points: ({ home, away }) => (home === undefined || away === undefined ? 0 : scorePrediction({ home, away }, result)), key: `${version}:${result.home}-${result.away}` }
  }
  if (kind === "winner") {
    const winner = winnerOf(event)
    return winner ? { voided: false, points: (prediction) => (prediction.winner ? scoreWinner(prediction.winner, winner) : 0), key: `${version}:winner:${nameKey(winner)}` } : null
  }
  if (kind === "podium" && event.score.kind === "classification" && event.score.entries.length >= PODIUM_SIZE) {
    const result = event.score.entries.slice(0, PODIUM_SIZE).map((entry) => entry.name)
    return { voided: false, points: (prediction) => (prediction.podium ? scorePodium(prediction.podium, result) : 0), key: `${version}:podium:${result.map(nameKey).join("|")}` }
  }
  return null
}

/**
 * Only a confirmed result or a published void rule settles anything. A void can still
 * be overturned, because a corrected result changes the key.
 */
function settlementFor(event: SportEvent, now = new Date()): Settlement | null {
  const voided: Settlement = { voided: true, points: () => 0, key: `v${SCORING_VERSION}:void` }
  if (event.status === "canceled" || event.status === "abandoned") return voided

  const start = event.scheduledStartUTC ? Date.parse(event.scheduledStartUTC) : Number.NaN
  const overdue = (days: number) => now.getTime() - start > days * DAY
  if (event.status === "postponed") return overdue(POSTPONED_VOID_DAYS) ? voided : null
  if (event.status !== "finished") return null

  const settled = resultSettlement(event, predictionKind(event))
  if (settled) return settled
  // A tied or drawn cricket match has both totals and no winner.
  if (event.score.kind === "innings") return voided
  return overdue(NO_RESULT_VOID_DAYS) ? voided : null
}

/**
 * Safe to run repeatedly. Each prediction stores the result it was scored against,
 * so a rerun changes nothing and a corrected score adjusts totals by the difference.
 */
export async function settleMatch(db: DocDb, event: SportEvent): Promise<{ settled: number }> {
  const settlement = settlementFor(event)
  if (!settlement) return { settled: 0 }

  const rows = await db.query<Prediction>("predictions", { where: [["matchId", event.id]] })
  let settled = 0
  for (const row of rows) {
    const changed = await db.transaction(async (tx) => {
      const current = await tx.get<Prediction>(predictionPath(event.id, row.uid))
      if (!current || current.settledKey === settlement.key) return false
      const totals = await tx.get<PointsDoc>(pointsPath(row.uid))

      const points = settlement.points(current)
      const wasExact = current.settled && current.points === POINTS.exact
      const isExact = points === POINTS.exact
      tx.set(predictionPath(event.id, row.uid), { settled: true, settledKey: settlement.key, voided: settlement.voided, points }, { merge: true })
      tx.set(pointsPath(row.uid), {
        uid: row.uid,
        displayName: current.displayName,
        points: (totals?.points ?? 0) + points - current.points,
        exact: (totals?.exact ?? 0) + Number(isExact) - Number(wasExact),
      })
      return true
    })
    if (changed) settled += 1
  }
  return { settled }
}

/** Equal points share a rank, so nobody is ordered by an arbitrary tie-break. */
export function sharedRanks<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  let rank = 0
  let previous: number | null = null
  return rows.map((row, index) => {
    if (row.points !== previous) rank = index + 1
    previous = row.points
    return { ...row, rank }
  })
}

export async function getLeaderboard(db: Pick<DocDb, "query" | "get">) {
  const rows = await db.query<PointsDoc>("prediction_points", { orderBy: { field: "points", direction: "desc" }, limit: LEADERBOARD_SIZE })
  const badges = await badgesFor(db, rows.map((row) => row.uid))
  return sharedRanks(rows).map(({ rank, uid, displayName, points, exact }) => ({ rank, displayName, points, exact, badges: badges.get(uid) ?? [] }))
}

// Far above the entries open at any one time, so the started ones are never cut off.
const PENDING_SCAN = 5000
const RECENT_MS = 2 * DAY
const RECHECK_DAYS = 7
const RECHECK_SCAN = 1000
const TICK_MS = 15 * 60_000

/** Walks a long list a few at a time, so nothing in it can keep its place for good. */
function inTurn<T>(items: T[], limit: number, now: Date): T[] {
  if (items.length <= limit) return items
  const start = Math.floor(now.getTime() / TICK_MS) * limit
  return Array.from({ length: limit }, (_, index) => items[(start + index) % items.length])
}

/**
 * Filters before limiting, then shares the slots: recent games settle right away, and
 * older ones such as postponed matches take turns instead of holding every slot.
 */
export async function pendingMatchIds(db: Pick<DocDb, "query">, limit = 20, now = new Date()): Promise<string[]> {
  const rows = await db.query<Prediction>("predictions", { where: [["settled", false]], limit: PENDING_SCAN })
  const kickoffs = new Map<string, string>()
  for (const row of rows) if (Date.parse(row.lockedAtUTC) <= now.getTime()) kickoffs.set(row.matchId, row.lockedAtUTC)
  const started = [...kickoffs].sort(([, a], [, b]) => a.localeCompare(b))
  const cutoff = now.getTime() - RECENT_MS
  const recent = started.filter(([, kickoff]) => Date.parse(kickoff) >= cutoff).map(([id]) => id)
  const older = started.filter(([, kickoff]) => Date.parse(kickoff) < cutoff).map(([id]) => id)
  const olderSlots = Math.max(Math.floor(limit / 2), limit - recent.length)
  const chosenOlder = inTurn(older, olderSlots, now)
  return [...chosenOlder, ...inTurn(recent, limit - chosenOlder.length, now)]
}

/** Settled matches from the past week, whose result can still be corrected at the source. */
export async function settledMatchIds(db: Pick<DocDb, "query">, limit = 20, now = new Date()): Promise<string[]> {
  const rows = await db.query<Prediction>("predictions", { orderBy: { field: "lockedAtUTC", direction: "desc" }, startAfter: now.toISOString(), limit: RECHECK_SCAN })
  const cutoff = now.getTime() - RECHECK_DAYS * DAY
  const ids = rows.filter((row) => row.settled && Date.parse(row.lockedAtUTC) >= cutoff).map((row) => row.matchId)
  return inTurn([...new Set(ids)], limit, now)
}

/**
 * One tick's settlement. Games already in the day's feed spend no provider call, and
 * one lookup failing costs that match its turn, not the job. settleMatch compares each
 * entry's stored result key, so a recheck of an unchanged result writes nothing.
 */
export async function settlePredictions(db: DocDb, input: { events: SportEvent[]; lookup(id: string): Promise<SportEvent | null> }, now = new Date()) {
  const inFeed = new Map(input.events.map((event) => [event.id, event]))
  const [pending, recheck] = await Promise.all([pendingMatchIds(db, 20, now), settledMatchIds(db, 20, now)])
  const ids = new Set([...pending, ...recheck])
  let settled = 0
  let failed = 0
  for (const matchId of ids) {
    try {
      const event = inFeed.get(matchId) ?? (await input.lookup(matchId))
      if (event) settled += (await settleMatch(db, event)).settled
    } catch (error) {
      failed += 1
      console.error("Settlement check failed", matchId, error instanceof Error ? error.message : "unknown")
    }
  }
  return { checked: ids.size, settled, failed }
}

export function predictionStatus(prediction: Pick<Prediction, "settled" | "voided" | "lockedAtUTC">, now: Date): PredictionStatus {
  if (prediction.voided) return "void"
  if (prediction.settled) return "settled"
  return now.getTime() < Date.parse(prediction.lockedAtUTC) ? "open" : "locked"
}

const MY_PREDICTIONS = 100
const GAME_LOOKUPS = 10

/**
 * Sorted here rather than in the query, which would need a composite index. Picks still
 * open lead, soonest first, then the rest newest first. Only entries older than the
 * stored game cost a lookup, and a game that cannot be found leaves the pick listed.
 */
export async function listMyPredictions(db: Pick<DocDb, "query">, uid: string, now: Date, lookup: (matchId: string) => Promise<SportEvent | null>) {
  const rows = await db.query<Prediction>("predictions", { where: [["uid", uid]] })
  const shown = rows
    .map((row) => ({ row, status: predictionStatus(row, now) }))
    .sort((a, b) => {
      const open = Number(b.status === "open") - Number(a.status === "open")
      if (open) return open
      const byKickoff = a.row.lockedAtUTC.localeCompare(b.row.lockedAtUTC)
      return a.status === "open" ? byKickoff : -byKickoff
    })
    .slice(0, MY_PREDICTIONS)

  const missing = [...new Set(shown.filter(({ row }) => !row.game).map(({ row }) => row.matchId))].slice(0, GAME_LOOKUPS)
  const found = await Promise.all(missing.map((id) => lookup(id).catch(() => null)))
  const games = new Map(found.flatMap((event) => (event ? [[event.id, gameOf(event)] as const] : [])))

  return shown.map(({ row, status }) => ({
    matchId: row.matchId,
    kind: row.kind ?? ("score" as PredictionKind),
    home: row.home ?? null,
    away: row.away ?? null,
    winner: row.winner ?? null,
    podium: row.podium ?? null,
    game: row.game ?? games.get(row.matchId) ?? null,
    kickoffUTC: row.lockedAtUTC,
    status,
    points: status === "settled" ? row.points : null,
  }))
}

export const toOwnPrediction = ({ kind = "score", home, away, winner, podium, settled, voided, points }: Prediction) => ({
  kind, home: home ?? null, away: away ?? null, winner: winner ?? null, podium: podium ?? null, settled, voided, points,
})
