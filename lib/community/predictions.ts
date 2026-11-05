// Free score predictions (spec section 5). No wagers, deposits or prizes: points
// exist only for the leaderboard. Rules are published in the UI from i18n.

import { ApiError } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"
import type { SportEvent, SportId } from "@/lib/sports/types"
import { assertNotSanctioned, readSanction } from "./chat"

export const SCORING_VERSION = 1
export const POINTS = { exact: 5, outcome: 2 } as const

const TEAM_SCORE_SPORTS = new Set<SportId>(["football", "basketball", "american-football", "baseball", "ice-hockey", "rugby", "volleyball"])
const MAX_SCORE = 300
const LEADERBOARD_SIZE = 50

export interface Prediction {
  uid: string
  displayName: string
  matchId: string
  home: number
  away: number
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

function validScore(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SCORE
}

/** The event comes from the server's own lookup; a client-sent kickoff is never read. */
export async function submitPrediction(
  db: DocDb,
  input: { uid: string; displayName: string; event: SportEvent; home: unknown; away: unknown },
  now: Date,
): Promise<Prediction> {
  const { uid, displayName, event, home, away } = input
  if (!supportsScorePrediction(event)) throw new ApiError(422, "not_supported", "Score predictions are for team sports only")
  if (!validScore(home) || !validScore(away)) throw new ApiError(400, "invalid_score", "Enter a valid score")

  const kickoff = event.scheduledStartUTC ? Date.parse(event.scheduledStartUTC) : Number.NaN
  if (event.status !== "scheduled" || Number.isNaN(kickoff) || now.getTime() >= kickoff) {
    throw new ApiError(409, "prediction_locked", "Predictions are locked for this match")
  }

  return db.transaction(async (tx) => {
    const existing = await tx.get<Prediction>(predictionPath(event.id, uid))
    const sanction = await readSanction(tx, uid)
    assertNotSanctioned(sanction, now, "participate")
    if (existing) throw new ApiError(409, "duplicate_prediction", "You already predicted this match")

    const prediction: Prediction = {
      uid, displayName, matchId: event.id, home, away,
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

export function scorePrediction(prediction: Pick<Prediction, "home" | "away">, result: { home: number; away: number }): number {
  if (prediction.home === result.home && prediction.away === result.away) return POINTS.exact
  return Math.sign(prediction.home - prediction.away) === Math.sign(result.home - result.away) ? POINTS.outcome : 0
}

type Settlement = { voided: boolean; points(prediction: Prediction): number; key: string }

/** Only a finished event with a score, or a canceled one, settles anything. */
function settlementFor(event: SportEvent): Settlement | null {
  if (event.status === "canceled" || event.status === "abandoned") {
    return { voided: true, points: () => 0, key: `v${SCORING_VERSION}:void` }
  }
  if (event.status === "finished" && event.score.kind === "team") {
    const result = { home: event.score.home, away: event.score.away }
    return { voided: false, points: (prediction) => scorePrediction(prediction, result), key: `v${SCORING_VERSION}:${result.home}-${result.away}` }
  }
  return null
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
export async function getLeaderboard(db: Pick<DocDb, "query">) {
  const rows = await db.query<PointsDoc>("prediction_points", { orderBy: { field: "points", direction: "desc" }, limit: LEADERBOARD_SIZE })
  let rank = 0
  let previous: number | null = null
  return rows.map((row, index) => {
    if (row.points !== previous) rank = index + 1
    previous = row.points
    return { rank, displayName: row.displayName, points: row.points, exact: row.exact }
  })
}

export async function pendingMatchIds(db: Pick<DocDb, "query">, limit = 20): Promise<string[]> {
  const rows = await db.query<Prediction>("predictions", { where: [["settled", false]], limit: 500 })
  return [...new Set(rows.map((row) => row.matchId))].slice(0, limit)
}
