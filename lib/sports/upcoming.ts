import { storedEvents, utcDate } from "./service"
import type { SportEvent } from "./types"

const DAY_MS = 86_400_000
const FRESH_MS = 10 * 60_000

let cache: { key: string; at: number; events: Promise<SportEvent[]> } | null = null

export function clearUpcomingCache(): void {
  cache = null
}

/** Stored days only, shared by every member, so calendars never spend provider calls. */
export function upcomingEvents(days: number, now: Date = new Date()): Promise<SportEvent[]> {
  const dates = Array.from({ length: days }, (_, offset) => utcDate(new Date(now.getTime() + offset * DAY_MS)))
  const key = dates.join()
  if (cache && cache.key === key && now.getTime() - cache.at < FRESH_MS) return cache.events
  const events = Promise.all(dates.map((date) => storedEvents(date))).then((perDay) => {
    const seen = new Set<string>()
    return perDay.flat().filter((event) => !seen.has(event.id) && seen.add(event.id))
  })
  const entry = { key, at: now.getTime(), events }
  cache = entry
  events.catch(() => {
    if (cache === entry) cache = null
  })
  return events
}
