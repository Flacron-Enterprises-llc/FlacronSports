// Football's own reading of the source: how long a stored state can be believed, what its
// round codes mean, and what a timeline proves about the score at half-time.

import type { EventConclusion, EventScore, FootballDetails, ScoreBreakdown, ScoreSegment } from "../types"

const MINUTE_MS = 60_000

// From kick-off, with stoppages and a late start allowed for. Past these a stored state has
// stopped being updated: the source leaves many regional games on the last state it heard.
const LATEST_MINUTE: Record<string, number> = { "": 180, NS: 180, TBD: 180, "NOT STARTED": 180, "1H": 90, HT: 105, "2H": 165, ET: 210, BT: 210, P: 240, LIVE: 240, "IN PLAY": 240 }

interface Stored {
  strStatus?: string | null
  strProgress?: string | null
}

/** A row the live feed is carrying is believed, because that feed drops a game once it ends. */
export function footballStateExpired(raw: Stored, startMs: number, now: Date): boolean {
  if (raw.strProgress) return false
  const latest = LATEST_MINUTE[(raw.strStatus ?? "").trim().toUpperCase()]
  return latest !== undefined && now.getTime() - startMs > latest * MINUTE_MS
}

const STOPPED = new Set(["HT", "BT", "P"])

/** The minute means nothing while play is stopped, and the feed still sends one. */
export function footballClock(status: string | null | undefined, progress: string | null | undefined): string | null {
  return progress && !STOPPED.has((status ?? "").trim().toUpperCase()) ? progress : null
}

/** What a card says beside the minute: only what the minute cannot. Without one, the half itself. */
export function footballShowsPhase(status: string | null | undefined, hasClock: boolean): boolean {
  const code = (status ?? "").trim().toUpperCase()
  return !hasClock || code === "ET"
}

// The source's codes above the match weeks, as checked in cups and league play-offs. Others
// mean different things by competition: 160 was the Champions League play-off round in
// 2024-25, and 400 is its qualifying, so they are not named.
const STAGES: Record<number, FootballDetails["stage"]> = { 125: "quarter", 150: "semi", 200: "final" }
const MOST_MATCH_WEEKS = 60

interface RawFootball {
  intRound?: string | number | null
  strGroup?: string | null
  strSeason?: string | null
  strCity?: string | null
  strCountry?: string | null
  strResult?: string | null
  strDescriptionEN?: string | null
}

const clean = (text: string | null | undefined) => text?.trim() || null

export function footballDetails(raw: RawFootball): FootballDetails {
  const round = Number(raw.intRound)
  return {
    kind: "football",
    round: Number.isInteger(round) && round > 0 && round <= MOST_MATCH_WEEKS ? round : null,
    stage: STAGES[round] ?? null,
    group: clean(raw.strGroup),
    season: clean(raw.strSeason),
    city: clean(raw.strCity),
    country: clean(raw.strCountry),
    summary: clean(raw.strResult) ?? clean(raw.strDescriptionEN),
  }
}

const CARD_REASONS = new Set(["foul", "serious foul", "dissent", "argument", "time wasting", "handball", "persistent infringement", "not retreating", "abusive language"])

/** The source writes the text "NULL" for no reason. */
export function cardReason(comment: string | null | undefined): { key: string | null; text: string } | null {
  const text = comment?.trim()
  if (!text || text.toUpperCase() === "NULL") return null
  const key = text.toLowerCase()
  return { key: CARD_REASONS.has(key) ? key : null, text }
}

const REVIEWS = new Set(["goal cancelled", "goal confirmed", "goal disallowed - offside", "penalty cancelled", "penalty confirmed", "card upgrade confirmed"])

export function reviewOutcome(detail: string | null | undefined): string | null {
  const key = detail?.trim().toLowerCase()
  return key && REVIEWS.has(key) ? key : null
}

interface TimelineRow {
  strTimeline?: string | null
  strTimelineDetail?: string | null
  strHome?: string | null
  intTime?: string | number | null
}

const FIRST_HALF_LAST_MINUTE = 45
const NORMAL_TIME_LAST_MINUTE = 90

/**
 * The score at each half, when the timeline proves it: the source flattens first-half
 * stoppage time onto minute 45, and some timelines miss a goal or a whole side, so only a
 * timeline whose goals add up to the final score is read. Shootout kicks are never listed.
 */
export function footballHalves(rows: TimelineRow[] | null | undefined, score: EventScore, conclusion?: EventConclusion): ScoreBreakdown | null {
  if (score.kind !== "team" || !rows?.length) return null
  const goals = rows.filter((row) => (row.strTimeline ?? "").trim().toLowerCase() === "goal" && !(row.strTimelineDetail ?? "").toLowerCase().includes("missed"))
  const minutes = goals.map((row) => Number(row.intTime))
  if (goals.some((row) => row.strHome !== "Yes" && row.strHome !== "No") || minutes.some((minute) => !Number.isFinite(minute) || minute <= 0)) return null
  const count = (side: string, from: number, to: number) => goals.filter((row, index) => row.strHome === side && minutes[index] >= from && minutes[index] <= to).length
  const span = (from: number, to: number) => ({ home: count("Yes", from, to), away: count("No", from, to) })
  const total = span(1, Number.POSITIVE_INFINITY)
  if (total.home !== score.home || total.away !== score.away) return null
  const segments: ScoreSegment[] = [{ kind: "half", number: 1, ...span(1, FIRST_HALF_LAST_MINUTE) }, { kind: "half", number: 2, ...span(FIRST_HALF_LAST_MINUTE + 1, NORMAL_TIME_LAST_MINUTE) }]
  if (conclusion === "extra-time" || conclusion === "penalties") segments.push({ kind: "extra", number: 1, ...span(NORMAL_TIME_LAST_MINUTE + 1, Number.POSITIVE_INFINITY) })
  return { segments }
}

interface LegRow {
  idEvent: string
  idHomeTeam?: string | null
  idAwayTeam?: string | null
  intRound?: string | number | null
  intHomeScore?: string | number | null
  intAwayScore?: string | number | null
  strTimestamp?: string | null
  strStatus?: string | null
}

const PLAYED = new Set(["FT", "AET", "PEN", "AP"])
const goals = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? Number.NaN : Number(value))
/** Cup league phases and groups stop short of this, and a pair meets once per round in them. */
const FIRST_KNOCKOUT_ROUND = 9

export const mayHaveLegs = (round: string | number | null | undefined) => Number(round) >= FIRST_KNOCKOUT_ROUND

/**
 * The tie so far, in this game's home and away order, worked out from the source's own two
 * scores. Only for the second of exactly two meetings in a round, with the sides swapped
 * and the first one played. The source states no aggregate of its own.
 */
export function legAggregate(raw: LegRow, rows: LegRow[]): { home: number; away: number } | null {
  if (!raw.idHomeTeam || !raw.idAwayTeam || !mayHaveLegs(raw.intRound)) return null
  const pair = [raw.idHomeTeam, raw.idAwayTeam]
  const meetings = rows.filter((row) => String(row.intRound) === String(raw.intRound) && pair.includes(row.idHomeTeam ?? "") && pair.includes(row.idAwayTeam ?? ""))
  const first = meetings.find((row) => row.idEvent !== raw.idEvent)
  if (meetings.length !== 2 || !first || first.idHomeTeam !== raw.idAwayTeam || !PLAYED.has((first.strStatus ?? "").trim().toUpperCase())) return null
  if ((first.strTimestamp ?? "") >= (raw.strTimestamp ?? "")) return null
  const home = goals(raw.intHomeScore) + goals(first.intAwayScore)
  const away = goals(raw.intAwayScore) + goals(first.intHomeScore)
  return Number.isInteger(home) && Number.isInteger(away) ? { home, away } : null
}
