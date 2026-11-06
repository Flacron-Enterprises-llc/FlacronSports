// The day feed misses most games in some sports: on a checked week cricket returned 0 or 1
// a day while its leagues listed dozens. For those sports the scheduled job walks each
// league's own lists and files every game under its date, so a day's page reads complete.
// A league call costs one place in the shared provider queue, so each tick takes a share.

import type { RawEvent } from "./thesportsdb"
import type { SportDefinition, SportId } from "./types"

const DAY_MS = 86_400_000

/** Sports whose day feed is thin. Add one here and the job starts walking its leagues. */
export const LEAGUE_COLLECTED = new Set<SportId>(["cricket", "tennis", "combat-sports", "motorsport"])

export const CALLS_PER_TICK = 100
/** Of those, how many ask for the results of games that have just ended. */
export const RESULT_CALLS = 20
/** Sports with results on the per-event endpoint. Cricket returned none in the check. */
export const RESULT_SPORTS = new Set<SportId>(["tennis", "motorsport", "combat-sports"])
const RESULT_RECHECK_MS = 6 * 3_600_000
const CALLS_PER_LEAGUE = 2

/**
 * A league's two lists: the next 20 games and the last 15. Tennis lists nothing ahead and a
 * tour plays hundreds of matches a month, so there the whole season is the list to read.
 */
export function leaguePaths(league: { id: string; sportId: SportId }, now: Date): string[] {
  const past = `eventspastleague.php?id=${league.id}`
  if (league.sportId === "tennis") return [`eventsseason.php?${new URLSearchParams({ id: league.id, s: String(now.getUTCFullYear()) })}`, past]
  return [`eventsnextleague.php?id=${league.id}`, past]
}
/** Leagues playing around today come first, but never crowd out the rotation. */
const ACTIVE_SHARE = 0.5

// As far back as a visitor can open, and far enough ahead to reach the next season's opener.
export const WINDOW_PAST_DAYS = 31
export const WINDOW_FUTURE_DAYS = 240

export interface CollectLeague {
  id: string
  name: string
  sportId: SportId
  providerKey: string
}

/** Event id to "date|league", the record of where each stored game is filed. */
export type CollectIndex = Record<string, string>

export const dayPath = (sport: Pick<SportDefinition, "providerKey">, date: string) => `collected/day?${new URLSearchParams({ d: date, s: sport.providerKey as string })}`
export const indexPath = (sport: Pick<SportDefinition, "providerKey">) => `collected/index?${new URLSearchParams({ s: sport.providerKey as string })}`

/** The date the day feed files a game under, so both sources agree on a game's day. */
export function rowDate(raw: Pick<RawEvent, "dateEvent" | "strTimestamp">): string | null {
  const date = raw.dateEvent?.trim() || raw.strTimestamp?.trim().slice(0, 10)
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

export function inCollectWindow(date: string, now: Date): boolean {
  const day = Date.parse(`${date}T00:00:00Z`)
  return day >= now.getTime() - WINDOW_PAST_DAYS * DAY_MS && day <= now.getTime() + WINDOW_FUTURE_DAYS * DAY_MS
}

const filled = (value: unknown) => value !== null && value !== undefined && value !== ""

/** A later reading fills or replaces fields. An empty field never wipes a known one. */
export function mergeRow(older: RawEvent, newer: RawEvent): RawEvent {
  return { ...older, ...Object.fromEntries(Object.entries(newer).filter(([, value]) => filled(value))) } as RawEvent
}

/** One row per stable event id. Later lists win field by field. */
export function mergeRows(...lists: (RawEvent[] | null | undefined)[]): RawEvent[] {
  const rows = new Map<string, RawEvent>()
  for (const list of lists) {
    for (const raw of list ?? []) {
      const known = rows.get(raw.idEvent)
      rows.set(raw.idEvent, known ? mergeRow(known, raw) : raw)
    }
  }
  return [...rows.values()]
}

// Images and links nobody here reads. A stored day is a Firestore document with a 1 MB cap.
const UNUSED = /^(?:strPoster|strBanner|strSquare|strFanart|strMap|strTweet\d|strFilename|strEventAlternate|strLeagueBadge|strLocked|intScoreVotes)$/

export const slimRow = (raw: RawEvent): RawEvent => Object.fromEntries(Object.entries(raw).filter(([key, value]) => filled(value) && !UNUSED.test(key))) as RawEvent

/** The rotation runs on the clock, so a restart picks up where the schedule would be. */
export function chooseLeagues(leagues: CollectLeague[], active: Set<string>, now: Date, tickMs: number, calls = CALLS_PER_TICK - RESULT_CALLS): CollectLeague[] {
  const room = Math.floor(calls / CALLS_PER_LEAGUE)
  const first = leagues.filter((league) => active.has(league.id)).slice(0, Math.ceil(room * ACTIVE_SHARE))
  const taken = new Set(first.map((league) => league.id))
  const rest = leagues.filter((league) => !taken.has(league.id))
  const share = Math.min(room - first.length, rest.length)
  const start = rest.length > 0 ? (Math.floor(now.getTime() / tickMs) * share) % rest.length : 0
  return [...first, ...Array.from({ length: share }, (_, index) => rest[(start + index) % rest.length])]
}

/** Leagues with a game filed from yesterday to tomorrow, which is where results are changing. */
export function activeLeagues(indexes: CollectIndex[], now: Date): Set<string> {
  const near = new Set([-1, 0, 1].map((offset) => new Date(now.getTime() + offset * DAY_MS).toISOString().slice(0, 10)))
  const leagues = new Set<string>()
  for (const index of indexes) {
    for (const entry of Object.values(index)) {
      const [date, league] = entry.split("|")
      if (near.has(date) && league) leagues.add(league)
    }
  }
  return leagues
}

/** Started, with no result text and no recent look. An empty answer is asked again later, as results arrive late. */
export function resultsWanted(rows: RawEvent[], now: Date): RawEvent[] {
  return rows.filter((raw) => {
    const start = Date.parse(`${raw.strTimestamp ?? ""}Z`)
    return !raw.strResult && !raw.resultRows?.length && start < now.getTime() && now.getTime() - (raw.resultsCheckedAt ?? 0) > RESULT_RECHECK_MS
  })
}

export interface GameDate {
  date: string
  games: number
}

/** The next dates with a game filed, soonest first. */
export function nextDates(index: CollectIndex, after: string, limit: number): GameDate[] {
  const counts = new Map<string, number>()
  for (const entry of Object.values(index)) {
    const date = entry.split("|")[0]
    if (date > after) counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, limit).map(([date, games]) => ({ date, games }))
}

export interface CollectStore {
  readDay(path: string): Promise<RawEvent[]>
  writeDay(path: string, rows: RawEvent[]): Promise<void>
}

/**
 * Files one sport's fresh rows under their dates. A game that moved leaves its old day,
 * so a rescheduled fixture never shows twice. Returns the updated index.
 */
export async function fileRows(sport: Pick<SportDefinition, "providerKey">, rows: RawEvent[], index: CollectIndex, store: CollectStore, now: Date): Promise<CollectIndex> {
  const next: CollectIndex = {}
  for (const [id, entry] of Object.entries(index)) if (inCollectWindow(entry.split("|")[0], now)) next[id] = entry

  const incoming = new Map<string, RawEvent[]>()
  const moved = new Map<string, Set<string>>()
  for (const raw of mergeRows(rows)) {
    const date = rowDate(raw)
    if (!date || !inCollectWindow(date, now)) continue
    incoming.set(date, [...(incoming.get(date) ?? []), slimRow(raw)])
    const before = next[raw.idEvent]?.split("|")[0]
    if (before && before !== date) moved.set(before, (moved.get(before) ?? new Set()).add(raw.idEvent))
    next[raw.idEvent] = `${date}|${raw.idLeague ?? ""}`
  }

  for (const date of new Set([...incoming.keys(), ...moved.keys()])) {
    const path = dayPath(sport, date)
    const gone = moved.get(date)
    const stored = (await store.readDay(path)).filter((raw) => !gone?.has(raw.idEvent))
    await store.writeDay(path, mergeRows(stored, incoming.get(date)))
  }
  return next
}
