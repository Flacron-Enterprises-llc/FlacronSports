import { featureOn } from "@/lib/api-auth"
import { countMetric } from "@/lib/ops/metrics"
import { coverageRules, videoAllowed } from "@/lib/sports/coverage"
import { getEvent, storedBroadcasts, storedDayAge, storedEvents, utcDate, type Broadcast } from "@/lib/sports/service"
import { byImportance, isMajorCompetition } from "@/lib/sports/priority"
import type { FeedState, SportEvent, SportId } from "@/lib/sports/types"
import { newestFirst, storedClips, type Clip } from "./scorebat"
import { evaluateViewing, type ViewingResult, type VideoSource } from "./viewing"

/**
 * Official league, tour and rights-holder channels. A feed listing a video is not
 * permission to show it, so anything else is left out and logged for review.
 */
const APPROVED_CHANNELS = new Set([
  "nba", "nfl", "nhl", "mlb", "wnba", "mls", "khl", "nbl", "basketballcl", "espncfb", "ufc", "pfl", "f1", "formula1", "motogp", "pgatour", "lpga", "atptour", "wta", "icc",
  "premierleague", "laliga", "laligaeasports", "bundesliga", "seriea", "ligue1", "uefa", "fifa", "cafonline", "concacaf", "conmebol",
  "tntsportsar", "tntsportsbr", "tntsportsuk", "espnfc", "espn", "skysports", "skysportsfootball", "skysportspremierleague", "beinsports", "dazn", "cbssportsgolazo", "nbcsports",
])

const VERIFY_TTL_MS = 3_600_000
const OEMBED_TIMEOUT_MS = 5000
const DAY_MS = 86_400_000
const HIGHLIGHT_DAYS = 4
const HIGHLIGHT_LIMIT = 24
const CLIP_LIMIT = 24
const BROADCAST_LIMIT = 30
// The full feed lists hundreds of videos. Each is checked with the video host, so
// they go in small batches and stop once the page has enough.
const CHECK_BATCH = 12
const CHECK_LIMIT = 96
const BROADCAST_GRACE_MS = 3 * 3_600_000
// The job refreshes today every fifteen minutes, so this means it has missed several runs.
const STALE_MS = 90 * 60_000

export interface VerifiedVideo {
  youtubeId: string
  channel: string
}

export interface Highlight extends VerifiedVideo {
  matchId: string
  title: string
  competition: string
  sportId: SportId
  thumbnailUrl: string | null
  dateUTC: string | null
}

export interface WatchFeed {
  /** Absent on a reply from a backend older than this field. */
  state?: FeedState
  updatedAt?: string | null
  /** Every competition with something on Watch, before the filters apply. */
  competitions?: string[]
  live: SportEvent[]
  highlights: Highlight[]
  /** Football only. */
  clips: Clip[]
  broadcasts: Broadcast[]
}

export interface WatchFilters {
  team?: string
  competition?: string
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

const CLIP_COUNTRIES: Record<string, string> = {
  england: "english", spain: "spanish", italy: "italian", germany: "german", france: "french", portugal: "portuguese",
  netherlands: "dutch", brazil: "brazilian", argentina: "argentinian", scotland: "scottish", turkey: "turkish",
}
const CLIP_CUPS = new Set(["champions league", "europa league", "conference league"])

/** Clips write "ENGLAND: Premier League" where fixtures write "English Premier League". */
export function competitionKey(name: string): string {
  const [prefix, rest] = fold(name).split(/:\s*/, 2)
  const text = rest === undefined ? prefix : CLIP_CUPS.has(prefix) ? `uefa ${prefix}` : `${CLIP_COUNTRIES[prefix] ?? prefix} ${rest}`
  return text.replace(/\s+/g, "")
}

const hasText = (texts: (string | null | undefined)[], needle: string) => texts.some((text) => text && fold(text).includes(needle))

/** Football clips exist for no other sport, and never stand in for one. */
export const clipsCover = (sport?: SportId): boolean => !sport || sport === "football"

export function youtubeId(url: string | null | undefined): string | null {
  return url?.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:[?&#/]|$)/)?.[1] ?? null
}

export function isApprovedChannel(authorUrl: string | null | undefined): boolean {
  const handle = authorUrl?.match(/youtube\.com\/@([\w.-]+)/i)?.[1]
  return Boolean(handle && APPROVED_CHANNELS.has(handle.toLowerCase()))
}

const verified = new Map<string, { video: VerifiedVideo | null; at: number }>()

/** oEmbed answers only for public videos whose owner allows embedding. */
export async function verifyVideo(id: string, fresh = false): Promise<VerifiedVideo | null> {
  const known = verified.get(id)
  if (!fresh && known && Date.now() - known.at < VERIFY_TTL_MS) return known.video
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS), cache: "no-store" }).catch(() => null)
  if (!response) return fresh ? null : (known?.video ?? null)
  let video: VerifiedVideo | null = null
  if (response.ok) {
    const body = (await response.json().catch(() => null)) as { author_name?: string; author_url?: string } | null
    if (isApprovedChannel(body?.author_url)) video = { youtubeId: id, channel: body?.author_name ?? "YouTube" }
    else console.log("Video channel not approved", body?.author_url ?? "unknown")
  }
  verified.set(id, { video, at: Date.now() })
  return video
}

const eventTitle = (event: SportEvent) => event.eventName || event.participants.map((participant) => participant.name).join(" vs ") || event.competition.name

/** Staff can switch video off for everything or one competition without touching its scores. */
export async function videoFor(event: SportEvent, fresh = false): Promise<VerifiedVideo | null> {
  const id = youtubeId(event.videoUrl)
  if (!id || !featureOn("FEATURE_VIDEO") || !videoAllowed(await coverageRules(), event.sportId, event.competition.name)) return null
  const video = await verifyVideo(id, fresh)
  if (fresh) countMetric(video ? "playback_ok" : "playback_failed")
  return video
}

/** Clips are football only. Their competition names come from the video feed, so each has its own switch. */
export async function allowedClips<T extends { competition: string }>(clips: T[]): Promise<T[]> {
  if (!featureOn("FEATURE_VIDEO")) return []
  const rules = await coverageRules()
  return clips.filter((clip) => videoAllowed(rules, "football", clip.competition))
}

function sourceFor(event: SportEvent, now: Date): VideoSource {
  return {
    id: `youtube-${youtubeId(event.videoUrl)}`,
    matchId: event.id,
    provider: "YouTube",
    type: "highlight",
    territories: [],
    providerEnforcesTerritory: true,
    validFromUTC: event.scheduledStartUTC ?? new Date(now.getTime() - DAY_MS).toISOString(),
    validToUTC: new Date(now.getTime() + DAY_MS).toISOString(),
    permitted: true,
    available: true,
    platforms: ["web"],
    requiresEntitlement: false,
    officialUrl: null,
  }
}

export interface MatchViewing extends ViewingResult {
  video: VerifiedVideo | null
  broadcasts: Broadcast[]
}

/** The same check runs when options are listed and again, uncached, when playback starts. */
export async function viewingFor(matchId: string, country: string | null, fresh = false): Promise<MatchViewing> {
  const now = new Date()
  const event = await getEvent(matchId).catch(() => null)
  const video = event ? await videoFor(event, fresh) : null
  const result = evaluateViewing(event && video ? [sourceFor(event, now)] : [], { country, platform: "web", entitled: false, now, status: event?.status ?? "unknown" })
  const days = [0, 1].map((offset) => utcDate(new Date(now.getTime() + offset * DAY_MS)))
  const listings = await Promise.all(days.map((date) => storedBroadcasts(date, event?.sportId)))
  const playable = result.options.some((option) => option.action === "watch_highlights")
  return { ...result, video: playable ? video : null, broadcasts: listings.flat().filter((broadcast) => broadcast.matchId === matchId) }
}

/** Filters run before the page limits, so a match past the first page is still found. */
export async function getWatchFeed(sport?: SportId, now: Date = new Date(), filters: WatchFilters = {}): Promise<WatchFeed> {
  const dayOf = (offset: number) => utcDate(new Date(now.getTime() + offset * DAY_MS))
  const [recent, listings] = await Promise.all([
    Promise.all(Array.from({ length: HIGHLIGHT_DAYS }, (_, index) => storedEvents(dayOf(-index), sport))),
    Promise.all([dayOf(0), dayOf(1)].map((date) => storedBroadcasts(date, sport))),
  ])

  const seen = new Set<string>()
  const events = recent.flat().filter((event) => !seen.has(event.id) && seen.add(event.id))
  const team = fold(filters.team?.trim() ?? "")
  const competition = filters.competition ? competitionKey(filters.competition) : null
  const inCompetition = (name: string) => !competition || competitionKey(name) === competition
  const wanted = (event: SportEvent) => inCompetition(event.competition.name) && (!team || hasText([event.eventName, ...event.participants.map((item) => item.name)], team))

  const listed = events.filter((event) => youtubeId(event.videoUrl))
  const withVideo = listed
    .filter(wanted)
    .sort((a, b) => Number(isMajorCompetition(b.competition.name)) - Number(isMajorCompetition(a.competition.name)) || (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? ""))

  const highlights: WatchFeed["highlights"] = []
  const candidates = withVideo.slice(0, CHECK_LIMIT)
  for (let index = 0; index < candidates.length && highlights.length < HIGHLIGHT_LIMIT; index += CHECK_BATCH) {
    const checked = await Promise.all(candidates.slice(index, index + CHECK_BATCH).map(async (event) => ({ event, video: await videoFor(event) })))
    highlights.push(...checked.flatMap(({ event, video }) => video ? [{
      ...video,
      matchId: event.id,
      title: eventTitle(event),
      competition: event.competition.name,
      sportId: event.sportId,
      thumbnailUrl: event.thumbnailUrl ?? null,
      dateUTC: event.scheduledStartUTC,
    }] : []))
  }
  highlights.splice(HIGHLIGHT_LIMIT)

  const earliest = now.getTime() - BROADCAST_GRACE_MS
  const shown = new Set<string>()
  const byId = new Map(events.map((event) => [event.id, event]))
  const upcoming = listings.flat()
    .filter((item) => item.startUTC !== null && Date.parse(item.startUTC) >= earliest)
    .filter((item) => !shown.has(item.id) && shown.add(item.id))
  const competitionOf = (item: Broadcast) => (item.matchId ? byId.get(item.matchId)?.competition.name : undefined)
  const broadcasts = upcoming
    .filter((item) => (!team || hasText([item.eventName], team)) && (!competition || inCompetition(competitionOf(item) ?? "")))
    .sort((a, b) => (a.startUTC ?? "").localeCompare(b.startUTC ?? ""))
    .slice(0, BROADCAST_LIMIT)

  const stored = clipsCover(sport) ? await storedClips(now.getTime()).then(allowedClips).catch(() => null) : []
  const clips = newestFirst(stored ?? [])
    .filter((clip) => inCompetition(clip.competition) && (!team || hasText([clip.title], team)))
    .slice(0, CLIP_LIMIT)
    .map(({ id, title, competition: name, thumbnailUrl, dateUTC }) => ({ id, title, competition: name, thumbnailUrl, dateUTC }))

  const live = events.filter((event) => event.status === "live")
  // Fixtures last: where both name a competition, their wording is the one kept.
  const names = [...(stored ?? []).map((clip) => clip.competition), ...upcoming.flatMap((item) => competitionOf(item) ?? []), ...[...listed, ...live].map((event) => event.competition.name)]
  const competitions = new Map(names.filter(Boolean).map((name) => [competitionKey(name), name]))

  const { oldest, complete } = storedDayAge(dayOf(0), sport)
  const fresh = oldest !== null && complete && stored !== null && now.getTime() - oldest < STALE_MS
  return {
    state: oldest === null ? "unavailable" : fresh ? "ok" : "stale",
    updatedAt: oldest === null ? null : new Date(oldest).toISOString(),
    competitions: [...competitions.values()].sort((a, b) => a.localeCompare(b)),
    live: live.filter(wanted).sort(byImportance).slice(0, 6),
    highlights,
    clips,
    broadcasts,
  }
}
