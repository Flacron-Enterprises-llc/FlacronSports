import { getEvent, storedBroadcasts, storedEvents, utcDate, type Broadcast } from "@/lib/sports/service"
import { byImportance, isMajorCompetition } from "@/lib/sports/priority"
import type { SportEvent, SportId } from "@/lib/sports/types"
import { storedClips, type Clip } from "./scorebat"
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
  live: SportEvent[]
  highlights: Highlight[]
  /** Football only, and older than a week on the current plan. */
  clips: Clip[]
  broadcasts: Broadcast[]
}

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

export async function videoFor(event: SportEvent, fresh = false): Promise<VerifiedVideo | null> {
  const id = youtubeId(event.videoUrl)
  return id ? verifyVideo(id, fresh) : null
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
  const result = evaluateViewing(event && video ? [sourceFor(event, now)] : [], { country, platform: "web", entitled: false, now })
  const days = [0, 1].map((offset) => utcDate(new Date(now.getTime() + offset * DAY_MS)))
  const listings = await Promise.all(days.map((date) => storedBroadcasts(date, event?.sportId)))
  const playable = result.options.some((option) => option.action === "watch_highlights")
  return { ...result, video: playable ? video : null, broadcasts: listings.flat().filter((broadcast) => broadcast.matchId === matchId) }
}

export async function getWatchFeed(sport?: SportId, now: Date = new Date()): Promise<WatchFeed> {
  const dayOf = (offset: number) => utcDate(new Date(now.getTime() + offset * DAY_MS))
  const [recent, listings] = await Promise.all([
    Promise.all(Array.from({ length: HIGHLIGHT_DAYS }, (_, index) => storedEvents(dayOf(-index), sport))),
    Promise.all([dayOf(0), dayOf(1)].map((date) => storedBroadcasts(date, sport))),
  ])

  const seen = new Set<string>()
  const events = recent.flat().filter((event) => !seen.has(event.id) && seen.add(event.id))
  const withVideo = events
    .filter((event) => youtubeId(event.videoUrl))
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
  const broadcasts = listings.flat()
    .filter((item) => item.startUTC !== null && Date.parse(item.startUTC) >= earliest)
    .filter((item) => !shown.has(item.id) && shown.add(item.id))
    .sort((a, b) => (a.startUTC ?? "").localeCompare(b.startUTC ?? ""))
    .slice(0, BROADCAST_LIMIT)

  const stored = !sport || sport === "football" ? await storedClips(now.getTime()).catch(() => []) : []
  const clips = stored.slice(0, CLIP_LIMIT).map(({ id, title, competition, thumbnailUrl, dateUTC }) => ({ id, title, competition, thumbnailUrl, dateUTC }))

  return { live: events.filter((event) => event.status === "live").sort(byImportance).slice(0, 6), highlights, clips, broadcasts }
}
