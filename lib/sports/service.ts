import { createHash } from "node:crypto"
import { gunzipSync, gzipSync } from "node:zlib"
import { ApiError } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { normalizeLineups, normalizeStats, normalizeTimeline, type MatchDetail, type RawLineup, type RawStat, type RawTimeline } from "./detail"
import { isCovered, normalizeEvent, PROVIDER_NAME, toUtc, type RawEvent } from "./thesportsdb"
import { SPORTS, type EventFeed, type SportDefinition, type SportEvent, type SportId } from "./types"

const BASE = "https://www.thesportsdb.com/api/v1/json"
const TIMEOUT_MS = 6000
const BACKEND_TIMEOUT_MS = 20_000
// Every provider call in this process shares one queue, so traffic and the scheduled
// job together stay under the rate limit. A visitor never waits long for a place.
const PROVIDER_GAP_MS = 3000
// The paid plan allows 100 calls a minute. This leaves room for the live score poll.
const PAID_PROVIDER_GAP_MS = 1000
const RATE_LIMIT_COOLDOWN_MS = 60_000
const VISITOR_MAX_WAIT_MS = 6000
const VISITOR_BUDGET_MS = 8000
const SNAPSHOT_FRESH_MS = 45 * 60_000
// Other days refresh in rotation, so their snapshots are older between visits.
const CALENDAR_FRESH_MS = 2 * 3_600_000
const REVALIDATE_SECONDS = 120
const LIVE_BASE = "https://www.thesportsdb.com/api/v2/json"
const LIVE_FRESH_MS = 60_000
const LIVE_LIMIT_MS = 5 * 60_000
const LIVE_TIMEOUT_MS = 4000

// "123" is the provider's public test key: a handful of events per query and no
// commercial licence. The feed is reported as limited until a paid key is set.
function apiKey(): { key: string; limited: boolean } {
  const key = process.env.THESPORTSDB_API_KEY
  return key ? { key, limited: false } : { key: "123", limited: true }
}

export const feedIsLimited = (): boolean => apiKey().limited

const FRESH_MS = REVALIDATE_SECONDS * 1000
const STALE_LIMIT_MS = 6 * 3_600_000
const PEEK_LIMIT_MS = 48 * 3_600_000

const memory = new Map<string, { data: unknown; at: number }>()
const inFlight = new Map<string, Promise<unknown>>()

export function clearFeedCache(): void {
  memory.clear()
  inFlight.clear()
  liveScores = { rows: new Map(), at: 0, tried: 0 }
}

let nextCallAt = 0

async function takeTurn(maxWaitMs: number): Promise<void> {
  if (process.env.NODE_ENV !== "production") return
  const now = Date.now()
  const at = Math.max(now, nextCallAt)
  if (at - now > maxWaitMs) throw new Error("Provider queue is full")
  nextCallAt = at + (apiKey().limited ? PROVIDER_GAP_MS : PAID_PROVIDER_GAP_MS)
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now))
}

async function request<T>(path: string, background = false): Promise<T> {
  const running = inFlight.get(path)
  if (running) return running as Promise<T>

  const task = (async () => {
    await takeTurn(background ? Number.POSITIVE_INFINITY : VISITOR_MAX_WAIT_MS)
    const response = await fetch(`${BASE}/${apiKey().key}/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status === 429) nextCallAt = Math.max(nextCallAt, Date.now() + RATE_LIMIT_COOLDOWN_MS)
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

export async function readSnapshot(path: string): Promise<Snapshot | null> {
  try {
    const doc = await snapshotDoc(path)?.get()
    if (!doc?.exists) return null
    const { body, packed, at } = doc.data() as { body?: string; packed?: Uint8Array; at: number }
    return { data: JSON.parse(packed ? gunzipSync(packed).toString("utf8") : (body as string)), at }
  } catch {
    return null
  }
}

export async function writeSnapshot(path: string, data: unknown, at: number): Promise<void> {
  // A busy football day is over 1 MB of JSON, the most one Firestore document can hold.
  const packed = gzipSync(JSON.stringify(data))
  await snapshotDoc(path)?.set({ packed, at }).catch((error: unknown) => {
    console.error("Snapshot not stored", error instanceof Error ? error.message : "unknown")
  })
}

/**
 * Visitors read the stored snapshot, and the scheduled job is what calls the
 * provider, so traffic cannot trip its rate limit. On any failure the last good
 * answer is kept and reported as stale, including after a restart.
 */
async function load<T>(path: string, refresh = false, snapshotFreshMs = SNAPSHOT_FRESH_MS, storedOnly = false): Promise<{ data: T; stale: boolean }> {
  const cached = memory.get(path)
  const now = Date.now()
  if (!refresh && cached && now - cached.at < FRESH_MS) return { data: cached.data as T, stale: false }

  const snapshot = refresh ? null : await readSnapshot(path)
  if (snapshot && now - snapshot.at < snapshotFreshMs) {
    memory.set(path, { data: snapshot.data, at: now })
    return { data: snapshot.data as T, stale: false }
  }
  // An older answer now beats a slow one. The scheduled job is what brings it up to date.
  if (snapshot && now - snapshot.at < STALE_LIMIT_MS) return { data: snapshot.data as T, stale: true }
  if (storedOnly) throw new ApiError(503, "provider_unavailable", "Sports data is temporarily unavailable")

  try {
    const data = await request<T>(path, refresh)
    memory.set(path, { data, at: now })
    await writeSnapshot(path, data, now)
    return { data, stale: false }
  } catch {
    const fallback = cached && now - cached.at < STALE_LIMIT_MS ? cached : (snapshot ?? (await readSnapshot(path)))
    if (fallback && now - fallback.at < STALE_LIMIT_MS) return { data: fallback.data as T, stale: true }
    throw new ApiError(503, "provider_unavailable", "Sports data is temporarily unavailable")
  }
}

/** What is already stored, with no provider call. For views that must never spend the quota. */
async function peek<T>(path: string): Promise<T | null> {
  const now = Date.now()
  const cached = memory.get(path)
  if (cached && now - cached.at < FRESH_MS) return cached.data as T
  const snapshot = await readSnapshot(path)
  if (!snapshot || now - snapshot.at >= PEEK_LIMIT_MS) return (cached?.data as T | undefined) ?? null
  memory.set(path, { data: snapshot.data, at: now })
  return snapshot.data as T
}

async function fetchJson<T>(path: string): Promise<T> {
  return (await load<T>(path)).data
}

async function eventsForSport(sport: SportDefinition, date: string, refresh = false, storedOnly = false): Promise<{ events: SportEvent[]; stale: boolean }> {
  const query = new URLSearchParams({ d: date, s: sport.providerKey as string })
  const nearToday = Math.abs(Date.parse(date) - Date.parse(utcDate())) <= 86_400_000
  const { data, stale } = await load<{ events: RawEvent[] | null }>(`eventsday.php?${query}`, refresh, nearToday ? SNAPSHOT_FRESH_MS : CALENDAR_FRESH_MS, storedOnly)
  // The sport is rechecked per record, so a stray row can never be filed under the wrong sport.
  return { events: rowsToEvents(data.events, sport, nearToday ? await liveRows() : NO_LIVE), stale }
}

function rowsToEvents(rows: RawEvent[] | null | undefined, sport: SportDefinition, live: LiveRows = NO_LIVE): SportEvent[] {
  return (rows ?? []).filter((raw) => (!raw.strSport || raw.strSport === sport.providerKey) && isCovered(raw, sport.id)).map((raw) => normalizeEvent(withLive(raw, live), sport.id))
}

interface RawLive {
  idEvent?: string | null
  intHomeScore?: string | number | null
  intAwayScore?: string | number | null
  strStatus?: string | null
  strProgress?: string | number | null
}

type LiveRows = Map<string, RawLive>

const NO_LIVE: LiveRows = new Map()
// The live feed carries one number per side, which only fits these sports' scores.
const NO_LIVE_OVERLAY = new Set(["Cricket", "Tennis", "Motorsport", "Fighting", "Golf"])

let liveScores: { rows: LiveRows; at: number; tried: number } = { rows: new Map(), at: 0, tried: 0 }
let liveLoading: Promise<void> | null = null

async function pollLiveScores(key: string): Promise<void> {
  const response = await fetch(`${LIVE_BASE}/livescore/all`, { headers: { "X-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Provider responded ${response.status}`)
  const { livescore } = (await response.json()) as { livescore?: RawLive[] | null }
  const rows: LiveRows = new Map()
  for (const row of livescore ?? []) if (row.idEvent) rows.set(row.idEvent, row)
  liveScores = { rows, at: Date.now(), tried: Date.now() }
}

/**
 * The fifteen minute job is far too slow for a game in progress, so this one call
 * runs at most once a minute however many people are watching. Failing leaves the
 * stored scores in place, and rows older than a few minutes are never presented as live.
 */
async function liveRows(): Promise<LiveRows> {
  const { key, limited } = apiKey()
  if (limited || process.env.API_ORIGIN) return NO_LIVE
  const now = Date.now()
  if (now - liveScores.tried >= LIVE_FRESH_MS) {
    liveScores.tried = now
    liveLoading ??= pollLiveScores(key).catch(() => undefined).finally(() => { liveLoading = null })
  }
  if (liveLoading) await liveLoading
  return Date.now() - liveScores.at < LIVE_LIMIT_MS ? liveScores.rows : NO_LIVE
}

function withLive(raw: RawEvent, live: LiveRows): RawEvent {
  const row = live.get(raw.idEvent)
  const status = row?.strStatus?.trim()
  if (!row || !status || status === "NS" || (raw.strSport && NO_LIVE_OVERLAY.has(raw.strSport))) return raw
  return {
    ...raw,
    strStatus: status,
    intHomeScore: row.intHomeScore ?? raw.intHomeScore,
    intAwayScore: row.intAwayScore ?? raw.intAwayScore,
    strProgress: row.strProgress === null || row.strProgress === undefined ? null : String(row.strProgress),
  }
}

/** The stored day for every enabled sport. Spends no provider calls. */
export async function storedEvents(date: string, sport?: SportId): Promise<SportEvent[]> {
  const sports = enabledSports().filter((item) => !sport || item.id === sport)
  const live = await liveRows()
  const days = await Promise.all(sports.map(async (item) => {
    const query = new URLSearchParams({ d: date, s: item.providerKey as string })
    return rowsToEvents((await peek<{ events: RawEvent[] | null }>(`eventsday.php?${query}`))?.events, item, live)
  }))
  return days.flat()
}

interface RawBroadcast {
  id?: string
  idEvent?: string | null
  strSport?: string | null
  strEvent?: string | null
  strChannel?: string | null
  strCountry?: string | null
  strLogo?: string | null
  strTimeStamp?: string | null
}

export interface Broadcast {
  id: string
  matchId: string | null
  eventName: string
  sportId: SportId
  channel: string
  country: string | null
  logoUrl: string | null
  startUTC: string | null
}

const tvPath = (date: string, sport: SportDefinition) => `eventstv.php?${new URLSearchParams({ d: date, s: sport.providerKey as string })}`

function toBroadcasts(rows: RawBroadcast[] | null | undefined, sport: SportDefinition): Broadcast[] {
  return (rows ?? []).flatMap((raw) => {
    if (!raw.strChannel || !raw.strEvent || (raw.strSport && raw.strSport !== sport.providerKey)) return []
    return [{
      id: raw.id ?? `${raw.idEvent}-${raw.strChannel}`,
      matchId: raw.idEvent ? `tsdb-${raw.idEvent}` : null,
      eventName: raw.strEvent,
      sportId: sport.id,
      channel: raw.strChannel,
      country: raw.strCountry || null,
      logoUrl: raw.strLogo || null,
      startUTC: toUtc(raw.strTimeStamp),
    }]
  })
}

/** Called by the scheduled job only. */
export async function refreshBroadcasts(date: string, sportId: SportId): Promise<void> {
  const sport = enabledSports().find((item) => item.id === sportId)
  if (sport) await load(tvPath(date, sport), true)
}

export async function storedBroadcasts(date: string, sport?: SportId): Promise<Broadcast[]> {
  const sports = enabledSports().filter((item) => !sport || item.id === sport)
  const days = await Promise.all(sports.map(async (item) => toBroadcasts((await peek<{ tvevents: RawBroadcast[] | null }>(tvPath(date, item)))?.tvevents, item)))
  return days.flat()
}

export function enabledSports(): SportDefinition[] {
  return SPORTS.filter((sport) => sport.enabled && sport.providerKey)
}

export function utcDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Set on Amplify. Keeping provider calls on one server is what keeps them under the rate limit. */
export async function fromBackend<T>(path: string): Promise<T | null> {
  const origin = process.env.API_ORIGIN
  if (!origin) return null
  const response = await fetch(`${origin}${path}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS) })
  if (response.status === 404) return { event: null } as T
  if (!response.ok) throw new ApiError(503, "provider_unavailable", "Sports data is temporarily unavailable")
  return response.json() as Promise<T>
}

export async function getEvents(options: { date?: string; sport?: SportId; refresh?: boolean } = {}): Promise<EventFeed> {
  const date = options.date ?? utcDate()
  const query = new URLSearchParams({ date, pageSize: "3000", ...(options.sport ? { sport: options.sport } : {}) })
  const sports = enabledSports().filter((sport) => !options.sport || sport.id === options.sport)
  const fetchedAt = new Date().toISOString()
  const base = { source: PROVIDER_NAME, fetchedAt, limited: apiKey().limited }
  // The frontend never calls the provider itself: its own retry would outlast the page timeout.
  if (process.env.API_ORIGIN && !options.refresh) {
    return (await fromBackend<EventFeed>(`/api/matches?${query}`).catch(() => null)) ?? { ...base, state: "unavailable", events: [] }
  }

  // One at a time: every sport at once is what trips the provider's rate limit.
  const succeeded: Awaited<ReturnType<typeof eventsForSport>>[] = []
  const deadline = Date.now() + VISITOR_BUDGET_MS
  for (const sport of sports) {
    const storedOnly = !options.refresh && Date.now() > deadline
    await eventsForSport(sport, date, options.refresh, storedOnly).then((result) => succeeded.push(result)).catch(() => undefined)
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
  return sport && isCovered(raw, sport.id) ? normalizeEvent(withLive(raw, await liveRows()), sport.id) : null
}

const DETAIL_FRESH_MS: Partial<Record<SportEvent["status"], number>> = { live: 90_000, finished: 6 * 3_600_000 }
const DETAIL_DEFAULT_FRESH_MS = 15 * 60_000

/**
 * Asked for by one game's page, so unlike the daily feeds it refreshes on the visit
 * itself. The last stored answer stands in if the provider cannot be reached.
 */
async function loadDetail<T>(path: string, freshMs: number): Promise<T> {
  const now = Date.now()
  const cached = memory.get(path)
  if (cached && now - cached.at < freshMs) return cached.data as T
  const snapshot = await readSnapshot(path)
  if (snapshot && now - snapshot.at < freshMs) return snapshot.data as T
  try {
    const data = await request<T>(path)
    memory.set(path, { data, at: now })
    await writeSnapshot(path, data, now)
    return data
  } catch (error) {
    if (cached) return cached.data as T
    if (snapshot) return snapshot.data as T
    throw error
  }
}

/** Empty, not an error, for a game the provider has no detail on. */
export async function getMatchDetail(event: SportEvent): Promise<MatchDetail> {
  const id = event.provider.eventId
  const freshMs = DETAIL_FRESH_MS[event.status] ?? DETAIL_DEFAULT_FRESH_MS
  const [timeline, stats, lineups] = await Promise.allSettled([
    loadDetail<{ timeline?: RawTimeline[] | null }>(`lookuptimeline.php?id=${id}`, freshMs),
    loadDetail<{ eventstats?: RawStat[] | null }>(`lookupeventstats.php?id=${id}`, freshMs),
    loadDetail<{ lineup?: RawLineup[] | null }>(`lookuplineup.php?id=${id}`, freshMs),
  ])
  const value = <T,>(result: PromiseSettledResult<T>): T | null => (result.status === "fulfilled" ? result.value : null)
  const detail = {
    timeline: normalizeTimeline(value(timeline)?.timeline),
    stats: normalizeStats(value(stats)?.eventstats),
    lineups: normalizeLineups(value(lineups)?.lineup),
    fetchedAt: new Date().toISOString(),
  }
  const hasData = detail.timeline.length > 0 || detail.stats.length > 0 || detail.lineups.home.length > 0 || detail.lineups.away.length > 0
  const failed = [timeline, stats, lineups].every((result) => result.status === "rejected")
  return { ...detail, state: hasData ? "ok" : failed ? "unavailable" : "empty" }
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
  if (process.env.API_ORIGIN) {
    const query = new URLSearchParams({ name, ...(sport ? { sport } : {}) })
    return (await fromBackend<TeamFixtures>(`/api/teams?${query}`).catch(() => null)) ?? { team: null, ...empty, feed: { ...base, limited: false, state: "unavailable" } }
  }

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
  if (process.env.API_ORIGIN) {
    return (await fromBackend<Standings>(`/api/standings/${encodeURIComponent(leagueId)}`).catch(() => null)) ?? { ...base, ...none, limited: false, state: "unavailable" }
  }
  try {
    const data = await fetchJson<{ table: RawStanding[] | null }>(`lookuptable.php?${new URLSearchParams({ l: leagueId })}`)
    if (!data.table?.length) return { ...base, ...none, state: "empty" }
    return { ...base, ...normalizeStandings(data.table), state: "ok" }
  } catch {
    return { ...base, ...none, state: "unavailable" }
  }
}
