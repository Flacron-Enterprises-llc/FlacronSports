// The second cricket source's daily allowance is small, so only the scheduled job calls it,
// spread evenly over the day, and visitors read what the job stored. No error or log line
// carries the request address, because the key travels in it.

import type { RawCricketMatch } from "./adapters/cricketdata"

const URL_BASE = "https://api.cricapi.com/v1/currentMatches"
const TIMEOUT_MS = 10_000
const DAY_MS = 86_400_000
export const DEFAULT_DAILY_HITS = 80
/** Left unspent each day, for an operator's own check. */
export const HITS_RESERVE = 5
/** Finished results kept after they leave the current list, so a day's page keeps them. */
const KEEP_RESULTS_MS = 14 * DAY_MS

export interface CricketBudget {
  /** UTC day the counts belong to. */
  day: string
  /** Calls this job made on that day, refused or not. */
  used: number
  lastAt: number
  hitsToday: number | null
  hitsLimit: number | null
  stopped: boolean
}

export function dailyHits(value: string | undefined = process.env.CRICKETDATA_DAILY_HITS): number {
  const parsed = Number(value)
  return value?.trim() && Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_HITS
}

export type BudgetDecision = { call: true; budget: CricketBudget } | { call: false; reason: "daily_limit" | "daily_budget" | "spacing"; budget: CricketBudget }

/**
 * One call per job run at most. By any time of day the job may have made its share of the
 * day so far, plus one, so a missed run is never made up in a burst; a half interval between
 * calls holds even if the job is started more often than usual.
 */
export function budgetDecision(saved: CricketBudget | null | undefined, now: Date, daily: number): BudgetDecision {
  const day = now.toISOString().slice(0, 10)
  const budget: CricketBudget = saved && saved.day === day ? saved : { day, used: 0, lastAt: saved?.lastAt ?? 0, hitsToday: null, hitsLimit: null, stopped: false }
  if (budget.stopped || (budget.hitsToday !== null && budget.hitsLimit !== null && budget.hitsToday >= budget.hitsLimit - HITS_RESERVE)) return { call: false, reason: "daily_limit", budget }
  if (budget.used >= daily) return { call: false, reason: "daily_budget", budget }
  const elapsed = now.getTime() - Date.parse(`${day}T00:00:00Z`)
  if (budget.used >= Math.floor((daily * elapsed) / DAY_MS) + 1) return { call: false, reason: "spacing", budget }
  if (now.getTime() - budget.lastAt < DAY_MS / daily / 2) return { call: false, reason: "spacing", budget }
  return { call: true, budget }
}

/** The source's own count decides when the day is over for us. */
export function afterAnswer(budget: CricketBudget, info: { hitsToday?: unknown; hitsLimit?: unknown } | null | undefined, refusedForLimit = false): CricketBudget {
  const hitsToday = typeof info?.hitsToday === "number" ? info.hitsToday : budget.hitsToday
  const hitsLimit = typeof info?.hitsLimit === "number" ? info.hitsLimit : budget.hitsLimit
  const spent = hitsToday !== null && hitsLimit !== null && hitsToday >= hitsLimit - HITS_RESERVE
  return { ...budget, hitsToday, hitsLimit, stopped: budget.stopped || refusedForLimit || spent }
}

export interface CricketAnswer {
  ok: boolean
  matches: RawCricketMatch[]
  info: { hitsToday?: number; hitsLimit?: number } | null
  /** Refused because the day's allowance is gone. */
  limitReached: boolean
}

const KEPT_FIELDS = ["id", "name", "matchType", "status", "venue", "date", "dateTimeGMT", "teams", "teamInfo", "score", "series_id", "matchStarted", "matchEnded"] as const

/** Only the fields the site reads. The answer also repeats the key, which must never be stored. */
function cleanMatch(row: unknown): RawCricketMatch | null {
  if (!row || typeof row !== "object" || typeof (row as { id?: unknown }).id !== "string") return null
  const source = row as Record<string, unknown>
  return Object.fromEntries(KEPT_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])) as unknown as RawCricketMatch
}

export async function fetchCurrentMatches(key: string, fetcher: typeof fetch = fetch): Promise<CricketAnswer> {
  let response: Response
  try {
    response = await fetcher(`${URL_BASE}?${new URLSearchParams({ apikey: key, offset: "0" })}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new Error("Cricket scores did not answer")
  }
  if (!response.ok) throw new Error(`Cricket scores responded ${response.status}`)
  const body = (await response.json().catch(() => null)) as { status?: unknown; reason?: unknown; info?: Record<string, unknown>; data?: unknown } | null
  if (!body) throw new Error("Cricket scores sent no readable answer")
  const info = body.info ? { hitsToday: typeof body.info.hitsToday === "number" ? body.info.hitsToday : undefined, hitsLimit: typeof body.info.hitsLimit === "number" ? body.info.hitsLimit : undefined } : null
  const ok = body.status === "success" && Array.isArray(body.data)
  return {
    ok,
    matches: ok ? (body.data as unknown[]).flatMap((row) => cleanMatch(row) ?? []) : [],
    info,
    limitReached: !ok && typeof body.reason === "string" && /limit|blocked/i.test(body.reason),
  }
}

/**
 * The new list, plus finished games from the last one that have since dropped off it. A game
 * that dropped off unfinished is left out: its last state of play is no longer true.
 */
export function keepMatches(previous: RawCricketMatch[], latest: RawCricketMatch[], now: Date, finished: (match: RawCricketMatch) => boolean): RawCricketMatch[] {
  const ids = new Set(latest.map((match) => match.id))
  const kept = previous.filter((match) => {
    if (ids.has(match.id) || !finished(match)) return false
    const at = Date.parse(match.dateTimeGMT ? `${match.dateTimeGMT.replace(/Z?$/, "Z")}` : `${match.date ?? ""}T00:00:00Z`)
    return Number.isFinite(at) && now.getTime() - at <= KEEP_RESULTS_MS
  })
  return [...latest, ...kept]
}
