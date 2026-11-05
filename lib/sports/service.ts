import { normalizeEvent, PROVIDER_NAME, type RawEvent } from "./thesportsdb"
import { SPORTS, type EventFeed, type SportDefinition, type SportEvent, type SportId } from "./types"

const BASE = "https://www.thesportsdb.com/api/v1/json"
const TIMEOUT_MS = 6000
const REVALIDATE_SECONDS = 120

// "123" is the provider's public test key: a handful of events per query and no
// commercial licence. The feed is reported as limited until a paid key is set.
function apiKey(): { key: string; limited: boolean } {
  const key = process.env.THESPORTSDB_API_KEY
  return key ? { key, limited: false } : { key: "123", limited: true }
}

async function fetchJson<T>(path: string): Promise<T> {
  const { key } = apiKey()
  const response = await fetch(`${BASE}/${key}/${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Provider responded ${response.status}`)
  return response.json() as Promise<T>
}

async function eventsForSport(sport: SportDefinition, date: string): Promise<SportEvent[]> {
  const query = new URLSearchParams({ d: date, s: sport.providerKey as string })
  const data = await fetchJson<{ events: RawEvent[] | null }>(`eventsday.php?${query}`)
  return (data.events ?? []).map((raw) => normalizeEvent(raw, sport.id))
}

export function enabledSports(): SportDefinition[] {
  return SPORTS.filter((sport) => sport.enabled && sport.providerKey)
}

export function utcDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export async function getEvents(options: { date?: string; sport?: SportId } = {}): Promise<EventFeed> {
  const date = options.date ?? utcDate()
  const sports = enabledSports().filter((sport) => !options.sport || sport.id === options.sport)
  const fetchedAt = new Date().toISOString()
  const base = { source: PROVIDER_NAME, fetchedAt, limited: apiKey().limited }

  const results = await Promise.allSettled(sports.map((sport) => eventsForSport(sport, date)))
  const succeeded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))

  if (sports.length > 0 && succeeded.length === 0) return { ...base, state: "unavailable", events: [] }

  const seen = new Set<string>()
  const events = succeeded
    .flat()
    .filter((event) => !seen.has(event.id) && seen.add(event.id))
    .sort((a, b) => (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? ""))

  return { ...base, state: succeeded.length < sports.length ? "stale" : "ok", events }
}

export async function getEvent(id: string): Promise<SportEvent | null> {
  const match = id.match(/^tsdb-(\d+)$/)
  if (!match) return null
  const data = await fetchJson<{ events: RawEvent[] | null }>(`lookupevent.php?id=${match[1]}`)
  const raw = data.events?.[0] as (RawEvent & { strSport?: string }) | undefined
  if (!raw) return null
  const sport = enabledSports().find((candidate) => candidate.providerKey === raw.strSport)
  return sport ? normalizeEvent(raw, sport.id) : null
}
