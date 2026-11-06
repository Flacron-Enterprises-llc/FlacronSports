import { createHash } from "node:crypto"
import { ApiError } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { isCovered, normalizeEvent, PROVIDER_NAME, toUtc, type RawEvent } from "./thesportsdb"
import { SPORTS, type EventFeed, type SportDefinition, type SportEvent, type SportId } from "./types"

const BASE = "https://www.thesportsdb.com/api/v1/json"
const TIMEOUT_MS = 6000
const BACKEND_TIMEOUT_MS = 20_000
const CALL_SPACING_MS = 400
const REFRESH_SPACING_MS = 2500
const SNAPSHOT_FRESH_MS = 45 * 60_000
// Other days refresh in rotation, so their snapshots are older between visits.
const CALENDAR_FRESH_MS = 2 * 3_600_000
const REVALIDATE_SECONDS = 120

// "123" is the provider's public test key: a handful of events per query and no
// commercial licence. The feed is reported as limited until a paid key is set.
function apiKey(): { key: string; limited: boolean } {
  const key = process.env.THESPORTSDB_API_KEY
  return key ? { key, limited: false } : { key: "123", limited: true }
}

const FRESH_MS = REVALIDATE_SECONDS * 1000
const STALE_LIMIT_MS = 6 * 3_600_000

const memory = new Map<string, { data: unknown; at: number }>()
const inFlight = new Map<string, Promise<unknown>>()

export function clearFeedCache(): void {
  memory.clear()
  inFlight.clear()
}

async function request<T>(path: string): Promise<T> {
  const running = inFlight.get(path)
  if (running) return running as Promise<T>

  const task = (async () => {
    const response = await fetch(`${BASE}/${apiKey().key}/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Provider responded ${response.status}`)
    return response.json() as Promise<T>
  })().finally(() => inFlight.delete(path))

  inFlight.set(path, task)
  return task
}

interface Snapshot {
  data: unknown
  at: number
}

const snapshotDoc = (path: string) =>
  getAdminDb()?.collection("feed_snapshots").doc(createHash("sha1").update(path).digest("hex"))

async function readSnapshot(path: string): Promise<Snapshot | null> {
  try {
    const doc = await snapshotDoc(path)?.get()
    if (!doc?.exists) return null
    const { body, at } = doc.data() as { body: string; at: number }
    return { data: JSON.parse(body), at }
  } catch {
    return null
  }
}

async function writeSnapshot(path: string, data: unknown, at: number): Promise<void> {
  await snapshotDoc(path)?.set({ body: JSON.stringify(data), at }).catch(() => undefined)
}

/**
 * Visitors read the stored snapshot, and the scheduled job is what calls the
 * provider, so traffic cannot trip its rate limit. On any failure the last good
 * answer is kept and reported as stale, including after a restart.
 */
async function load<T>(path: string, refresh = false, snapshotFreshMs = SNAPSHOT_FRESH_MS): Promise<{ data: T; stale: boolean }> {
  const cached = memory.get(path)
  const now = Date.now()
  if (!refresh && cached && now - cached.at < FRESH_MS) return { data: cached.data as T, stale: false }

  const snapshot = refresh ? null : await readSnapshot(path)
  if (snapshot && now - snapshot.at < snapshotFreshMs) {
    memory.set(path, { data: snapshot.data, at: now })
    return { data: snapshot.data as T, stale: false }
  }

  try {
    const data = await request<T>(path)
    memory.set(path, { data, at: now })
    await writeSnapshot(path, data, now)
    return { data, stale: false }
  } catch {
    const fallback = cached && now - cached.at < STALE_LIMIT_MS ? cached : (snapshot ?? (await readSnapshot(path)))
    if (fallback && now - fallback.at < STALE_LIMIT_MS) return { data: fallback.data as T, stale: true }
    throw new ApiError(503, "provider_unavailable", "Sports data is temporarily unavailable")
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  return (await load<T>(path)).data
}

async function eventsForSport(sport: SportDefinition, date: string, refresh = false): Promise<{ events: SportEvent[]; stale: boolean }> {
  const query = new URLSearchParams({ d: date, s: sport.providerKey as string })
  const nearToday = Math.abs(Date.parse(date) - Date.parse(utcDate())) <= 86_400_000
  const { data, stale } = await load<{ events: RawEvent[] | null }>(`eventsday.php?${query}`, refresh, nearToday ? SNAPSHOT_FRESH_MS : CALENDAR_FRESH_MS)
  // The sport is rechecked per record, so a stray row can never be filed under the wrong sport.
  const rows = (data.events ?? []).filter((raw) => (!raw.strSport || raw.strSport === sport.providerKey) && isCovered(raw, sport.id))
  return { events: rows.map((raw) => normalizeEvent(raw, sport.id)), stale }
}

export function enabledSports(): SportDefinition[] {
  return SPORTS.filter((sport) => sport.enabled && sport.providerKey)
}

export function utcDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Set on Amplify. Keeping provider calls on one server is what keeps them under the rate limit. */
async function fromBackend<T>(path: string): Promise<T | null> {
  const origin = process.env.API_ORIGIN
  if (!origin) return null
  const response = await fetch(`${origin}${path}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS) })
  if (response.status === 404) return { event: null } as T
  if (!response.ok) throw new ApiError(503, "provider_unavailable", "Sports data is temporarily unavailable")
  return response.json() as Promise<T>
}

export async function getEvents(options: { date?: string; sport?: SportId; refresh?: boolean } = {}): Promise<EventFeed> {
  const date = options.date ?? utcDate()
  const query = new URLSearchParams({ date, pageSize: "500", ...(options.sport ? { sport: options.sport } : {}) })
  const remote = options.refresh ? null : await fromBackend<EventFeed>(`/api/matches?${query}`).catch(() => null)
  if (remote) return remote
  const sports = enabledSports().filter((sport) => !options.sport || sport.id === options.sport)
  const fetchedAt = new Date().toISOString()
  const base = { source: PROVIDER_NAME, fetchedAt, limited: apiKey().limited }

  // One at a time: every sport at once is what trips the provider's rate limit.
  const succeeded: Awaited<ReturnType<typeof eventsForSport>>[] = []
  for (const sport of sports) {
    await eventsForSport(sport, date, options.refresh).then((result) => succeeded.push(result)).catch(() => undefined)
    if (process.env.NODE_ENV === "production") await new Promise((resolve) => setTimeout(resolve, options.refresh ? REFRESH_SPACING_MS : CALL_SPACING_MS))
  }

  if (sports.length > 0 && succeeded.length === 0) return { ...base, state: "unavailable", events: [] }

  const seen = new Set<string>()
  const events = succeeded
    .flatMap((result) => result.events)
    .filter((event) => !seen.has(event.id) && seen.add(event.id))
    .sort((a, b) => (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? ""))

  const complete = succeeded.length === sports.length && succeeded.every((result) => !result.stale)
  return { ...base, state: complete ? "ok" : "stale", events }
}

/** A rate-limited lookup can still be answered from a daily feed already in memory. */
async function lookupRaw(providerId: string): Promise<RawEvent | undefined> {
  const inMemory = () => {
    for (const entry of memory.values()) {
      const found = (entry.data as { events?: RawEvent[] | null }).events?.find((event) => event.idEvent === providerId)
      if (found) return found
    }
    return undefined
  }
  const known = inMemory()
  if (known) return known
  return (await fetchJson<{ events: RawEvent[] | null }>(`lookupevent.php?id=${providerId}`)).events?.[0]
}

export async function getEvent(id: string): Promise<SportEvent | null> {
  if (process.env.API_ORIGIN) {
    const remote = await fromBackend<{ event: SportEvent | null }>(`/api/matches/${encodeURIComponent(id)}`)
    return remote?.event ?? null
  }
  const match = id.match(/^tsdb-(\d+)$/)
  if (!match) return null
  const raw = await lookupRaw(match[1])
  if (!raw) return null
  const sport = enabledSports().find((candidate) => candidate.providerKey === raw.strSport)
  return sport && isCovered(raw, sport.id) ? normalizeEvent(raw, sport.id) : null
}

interface RawTeam {
  idTeam: string
  strTeam: string
  strSport?: string | null
}

export interface TeamFixtures {
  team: { id: string; name: string; sportId: SportId } | null
  upcoming: SportEvent[]
  recent: SportEvent[]
  feed: Omit<EventFeed, "events">
}

function chooseTeam(teams: RawTeam[], name: string, sport?: SportId) {
  const wanted = name.toLowerCase()
  const candidates = teams.flatMap((team) => {
    const definition = enabledSports().find((item) => item.providerKey === team.strSport)
    return definition && team.strTeam.toLowerCase() === wanted ? [{ id: team.idTeam, name: team.strTeam, sportId: definition.id }] : []
  })
  return candidates.find((team) => team.sportId === sport) ?? candidates[0] ?? null
}

/** A name the provider does not know gives team: null, which is not the same as a failed lookup. */
export async function getTeamFixtures(name: string, sport?: SportId): Promise<TeamFixtures> {
  const base = { source: PROVIDER_NAME, fetchedAt: new Date().toISOString(), limited: apiKey().limited }
  const empty = { upcoming: [], recent: [] }

  let team: TeamFixtures["team"]
  try {
    const found = await fetchJson<{ teams: RawTeam[] | null }>(`searchteams.php?${new URLSearchParams({ t: name })}`)
    team = chooseTeam(found.teams ?? [], name, sport)
  } catch {
    return { team: null, ...empty, feed: { ...base, state: "unavailable" } }
  }
  if (!team) return { team: null, ...empty, feed: { ...base, state: "ok" } }

  const { id, sportId } = team
  const [next, last] = await Promise.allSettled([
    fetchJson<{ events: RawEvent[] | null }>(`eventsnext.php?id=${id}`),
    fetchJson<{ results: RawEvent[] | null }>(`eventslast.php?id=${id}`),
  ])
  const failures = [next, last].filter((result) => result.status === "rejected").length
  const events = (rows: RawEvent[] | null | undefined) => (rows ?? []).filter((raw) => isCovered(raw, sportId)).map((raw) => normalizeEvent(raw, sportId))
  return {
    team,
    upcoming: next.status === "fulfilled" ? events(next.value.events) : [],
    recent: last.status === "fulfilled" ? events(last.value.results) : [],
    feed: { ...base, state: failures === 2 ? "unavailable" : failures === 1 ? "stale" : "ok" },
  }
}

export interface StandingRow {
  rank: number | null
  team: string
  played: number | null
  won: number | null
  drawn: number | null
  lost: number | null
  scoredFor: number | null
  scoredAgainst: number | null
  difference: number | null
  points: number | null
  form: string | null
}

export interface Standings {
  state: "ok" | "empty" | "unavailable"
  league: string | null
  season: string | null
  rows: StandingRow[]
  source: string
  fetchedAt: string
  /** The provider's own update time for the table, when it supplies one. */
  sourceUpdatedAt: string | null
  limited: boolean
}

type RawStanding = Record<string, string | number | null | undefined>

/** Null, not zero, for a missing value. Goal difference can be negative. */
function count(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeStandings(table: RawStanding[]): Pick<Standings, "league" | "season" | "rows" | "sourceUpdatedAt"> {
  const first = table[0]
  const text = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? null : String(value))
  const updated = table.map((row) => toUtc(text(row.dateUpdated))).filter((value): value is string => Boolean(value)).sort().at(-1)
  return {
    league: text(first?.strLeague),
    season: text(first?.strSeason),
    sourceUpdatedAt: updated ?? null,
    rows: table.map((row) => ({
      rank: count(row.intRank),
      team: text(row.strTeam) ?? "TBD",
      played: count(row.intPlayed),
      won: count(row.intWin),
      drawn: count(row.intDraw),
      lost: count(row.intLoss),
      scoredFor: count(row.intGoalsFor),
      scoredAgainst: count(row.intGoalsAgainst),
      difference: count(row.intGoalDifference),
      points: count(row.intPoints),
      form: text(row.strForm),
    })),
  }
}

export async function getStandings(leagueId: string): Promise<Standings> {
  const base = { source: PROVIDER_NAME, fetchedAt: new Date().toISOString(), limited: apiKey().limited }
  const none = { league: null, season: null, rows: [], sourceUpdatedAt: null }
  try {
    const data = await fetchJson<{ table: RawStanding[] | null }>(`lookuptable.php?${new URLSearchParams({ l: leagueId })}`)
    if (!data.table?.length) return { ...base, ...none, state: "empty" }
    return { ...base, ...normalizeStandings(data.table), state: "ok" }
  } catch {
    return { ...base, ...none, state: "unavailable" }
  }
}
