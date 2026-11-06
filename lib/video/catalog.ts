import { featureOn } from "@/lib/api-auth"
import { countMetric } from "@/lib/ops/metrics"
import { LEAGUE_COLLECTED } from "@/lib/sports/collect"
import { coverageRules, videoAllowed } from "@/lib/sports/coverage"
import { getEvent, storedBroadcasts, storedDayAge, storedEvents, storedGameDates, utcDate, type Broadcast } from "@/lib/sports/service"
import { byImportance, isMajorCompetition } from "@/lib/sports/priority"
import type { FeedState, SportEvent, SportId } from "@/lib/sports/types"
import { buildFacets, clipFacets, competitionKey, eventFacets, matchesWatch, SPORT_FACETS, type FacetChoice, type FacetKey, type FacetValues, type WatchFacet, type WatchItem } from "./facets"
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
  // Added 2026-11-07 from the channels the feed really lists, each tied to its league or rights holder.
  // Football
  "theafchub", // Asian Football Confederation: AFC Champions League Elite and Two
  "ligaprofesional", // Argentine league, run by the AFA
  "aleagues", // Australian A-Leagues
  "usl", // United Soccer League
  "cplsoccer", // Canadian Premier League
  "theefl", // English Football League
  "laligahypermotion", // LaLiga's second division
  "ligabbvamx", // Liga MX
  "ligafutve", // Venezuelan league
  "ekstraklasa", // Polish league
  "jleagueinternational", // J.League
  "vsportsportugal", // Liga Portugal
  "bundesliga-at", // Austrian Bundesliga
  "prvaligats", // Slovenian league
  "winsportstv", // Colombian league rights holder through 2026; review when the contract ends
  "l1max_", // Peruvian Liga 1 rights holder
  "futvcr", // Costa Rican league rights holder, for its share of the clubs
  "tntsportscl", // Chilean league rights holder, to 2033
  "orangesportromania", // Romanian SuperLiga broadcaster; latest source undated, so review first
  "tntsportsfootball", // UK rights holder: UEFA Champions League, MotoGP
  // Basketball
  "euroleague", // EuroLeague Basketball
  "bkteurocup", // EuroCup, run by EuroLeague Basketball
  // American football
  "cfl", // Canadian Football League
  // Baseball
  "kbo1982", // Korean KBO League
  // Tennis
  "tennistv", // ATP Tour's own streaming service
  "rolandgarros", "wimbledon", "usopen", // The Grand Slams' own channels
  "mcrolexmasters", // Monte-Carlo Masters
  // Cricket
  "bigbash", // Cricket Australia's Big Bash League
  "windiescricket", // Cricket West Indies
  "foxcricket", // Fox Sports Australia, the Australian rights holder
  // Rugby
  "unitedrugbychampionship", // United Rugby Championship
  "rlwc2026", // Rugby League World Cup
  "prem-rugby", // Premiership Rugby
  "sixnationsrugby", // Six Nations
  // Volleyball
  "cevolleyball", // European Volleyball Confederation
  // Combat sports
  "daznboxing", // DAZN's boxing channel, rights holder for the cards it lists
  "nolimitboxingau", // No Limit Boxing, promoter of its own cards
  "tntfightsports", // TNT Sports, rights holder for UFC and boxing
  // Motorsport
  "tntsports", // UK rights holder: MotoGP, Premiership Rugby
])

const VERIFY_TTL_MS = 3_600_000
const OEMBED_TIMEOUT_MS = 5000
const DAY_MS = 86_400_000
const HIGHLIGHT_DAYS = 4
// One sport at a time reads further back: most games a week apart, and sports with a
// league store rarely list a video, so four days would often show none that exist.
const SPORT_HIGHLIGHT_DAYS = 7
const COLLECTED_HIGHLIGHT_DAYS = 21
const HIGHLIGHT_LIMIT = 24
const CLIP_LIMIT = 24
const BROADCAST_LIMIT = 40
// A big game lists dozens of channels and would push every later game off the list.
const CHANNELS_PER_GAME = 4
const LIVE_LIMIT = 12
// The full feed lists hundreds of videos. Each is checked with the video host, so
// they go in small batches and stop once the page has enough.
const CHECK_BATCH = 12
const CHECK_LIMIT = 96
// The backend reply has 20 seconds. Whatever is unchecked by then waits for the next visit.
const CHECK_BUDGET_MS = 8000
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
  /** Every competition with something on Watch, with the other filters applied. */
  competitions?: string[]
  /** This sport's own filters. Every option listed returns something. */
  facets?: WatchFacet[]
  /** Only for one sport with no video to show. */
  nextGame?: NextGame | null
  live: SportEvent[]
  highlights: Highlight[]
  /** Football only. */
  clips: Clip[]
  broadcasts: Broadcast[]
}

export interface NextGame {
  matchId: string
  title: string
  competition: string
  startUTC: string | null
  dateOnly: boolean
}

export interface WatchFilters extends FacetChoice {
  /** Free text, read against names and competitions. */
  q?: string
  /** Only what can be played here, so options and results agree with the checkbox. */
  watchable?: boolean
}

export { competitionKey }

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
  /** Set by the route, from the network and never from a profile preference. */
  viewerCountry?: string | null
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

const byNewest = (a: SportEvent, b: SportEvent) => Number(isMajorCompetition(b.competition.name)) - Number(isMajorCompetition(a.competition.name)) || (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? "")

/** Turn about across sports, so the busiest one cannot fill the page or the check budget. */
export function takeTurns<T extends { sportId: SportId }>(rows: T[]): T[] {
  const queues = new Map<SportId, T[]>()
  for (const row of rows) queues.set(row.sportId, [...(queues.get(row.sportId) ?? []), row])
  const lists = [...queues.values()]
  const longest = Math.max(0, ...lists.map((list) => list.length))
  return Array.from({ length: longest }, (_, index) => lists.flatMap((list) => (index < list.length ? [list[index]] : []))).flat()
}

async function checkVideos(events: SportEvent[], known: Map<string, VerifiedVideo>, deadline: number): Promise<void> {
  const unchecked = events.filter((event) => !known.has(event.id))
  for (let index = 0; index < unchecked.length && Date.now() < deadline; index += CHECK_BATCH) {
    const checked = await Promise.all(unchecked.slice(index, index + CHECK_BATCH).map(async (event) => ({ event, video: await videoFor(event) })))
    for (const { event, video } of checked) if (video) known.set(event.id, video)
  }
}

const eventText = (event: SportEvent) => [event.eventName, event.competition.name, ...event.participants.map((item) => item.name)]

const eventItem = (event: SportEvent): WatchItem<SportEvent> => ({ value: event, facets: eventFacets(event), text: eventText(event) })

function toHighlight(event: SportEvent, video: VerifiedVideo): Highlight {
  return { ...video, matchId: event.id, title: eventTitle(event), competition: event.competition.name, sportId: event.sportId, thumbnailUrl: event.thumbnailUrl ?? null, dateUTC: event.scheduledStartUTC }
}

/** The fighting feed's listings include shows this product leaves out, and name no league to tell them by. */
const listingShown = (item: Broadcast, event: SportEvent | undefined) => item.sportId !== "combat-sports" || Boolean(event)

function perGame(rows: WatchItem<Broadcast>[]): WatchItem<Broadcast>[] {
  const counts = new Map<string, number>()
  return rows.filter(({ value }) => {
    const key = value.matchId ?? value.eventName
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return (counts.get(key) as number) <= CHANNELS_PER_GAME
  })
}

/** The first game still to come, for a sport with nothing to watch yet. Reads only what is stored. */
export async function nextGameFor(sport: SportId, now: Date = new Date()): Promise<NextGame | null> {
  for (const { date } of await storedGameDates(sport, utcDate(now)).catch(() => [])) {
    const ahead = (await storedEvents(date, sport))
      .filter((event) => event.status === "scheduled" && (event.scheduledStartUTC === null || Date.parse(event.scheduledStartUTC) > now.getTime()))
      .sort((a, b) => (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? ""))
    const event = ahead[0]
    if (event) return { matchId: event.id, title: eventTitle(event), competition: event.competition.name, startUTC: event.scheduledStartUTC, dateOnly: event.dateOnly === true }
  }
  return null
}

/** Options come from everything held, and filters run before the page limits. */
export async function getWatchFeed(sport?: SportId, now: Date = new Date(), filters: WatchFilters = {}): Promise<WatchFeed> {
  const dayOf = (offset: number) => utcDate(new Date(now.getTime() + offset * DAY_MS))
  // Tomorrow is held too: its listings need their games to name a competition or a team.
  const lookBack = !sport ? HIGHLIGHT_DAYS : LEAGUE_COLLECTED.has(sport) ? COLLECTED_HIGHLIGHT_DAYS : SPORT_HIGHLIGHT_DAYS
  const days = [1, ...Array.from({ length: lookBack }, (_, index) => -index)]
  const [recent, listings] = await Promise.all([
    Promise.all(days.map((offset) => storedEvents(dayOf(offset), sport))),
    Promise.all([dayOf(0), dayOf(1)].map((date) => storedBroadcasts(date, sport))),
  ])

  const seen = new Set<string>()
  const events = recent.flat().filter((event) => !seen.has(event.id) && seen.add(event.id))
  const byId = new Map(events.map((event) => [event.id, event]))
  const choice: FacetChoice = Object.fromEntries(Object.entries(filters).filter(([key, value]) => key !== "q" && key !== "watchable" && value))
  const query = filters.q?.trim() ?? ""
  const narrowed = Object.keys(choice).length > 0 || Boolean(query)

  const listed = takeTurns(events.filter((event) => youtubeId(event.videoUrl)).sort(byNewest))
  const known = new Map<string, VerifiedVideo>()
  const deadline = Date.now() + CHECK_BUDGET_MS
  await checkVideos(listed.slice(0, CHECK_LIMIT), known, deadline)
  // A filtered view looks past the first share, so a game far down the list is still found.
  if (narrowed) await checkVideos(listed.filter((event) => matchesWatch(eventItem(event), choice, query)).slice(0, CHECK_LIMIT), known, deadline)
  const highlightItems: WatchItem<Highlight>[] = listed.flatMap((event) => {
    const video = known.get(event.id)
    return video ? [{ value: toHighlight(event, video), facets: eventFacets(event), text: eventText(event) }] : []
  })

  const earliest = now.getTime() - BROADCAST_GRACE_MS
  const shown = new Set<string>()
  const listingItems: WatchItem<Broadcast>[] = listings.flat()
    .filter((item) => item.startUTC !== null && Date.parse(item.startUTC) >= earliest)
    .filter((item) => listingShown(item, item.matchId ? byId.get(item.matchId) : undefined))
    .filter((item) => !shown.has(item.id) && shown.add(item.id))
    .map((item) => {
      const event = item.matchId ? byId.get(item.matchId) : undefined
      return { value: item, facets: event ? eventFacets(event) : ({} as FacetValues), text: [item.eventName, item.channel, ...(event ? eventText(event) : [])] }
    })

  const stored = clipsCover(sport) ? await storedClips(now.getTime()).then(allowedClips).catch(() => null) : []
  const clipItems: WatchItem<Clip>[] = newestFirst(stored ?? []).map(({ id, title, competition, thumbnailUrl, dateUTC }) => ({
    value: { id, title, competition, thumbnailUrl, dateUTC },
    facets: clipFacets(title, competition),
    text: [title, competition],
  }))

  const liveItems = events.filter((event) => event.status === "live").map(eventItem)
  const watchable = filters.watchable === true
  const pool: WatchItem<unknown>[] = [...highlightItems, ...clipItems, ...(watchable ? [] : [...liveItems, ...listingItems])]
  const keys: FacetKey[] = sport ? SPORT_FACETS[sport] : ["competition"]
  const facets = buildFacets(keys, pool, choice, query)
  const pick = <T,>(items: WatchItem<T>[]) => items.filter((item) => matchesWatch(item, choice, query))

  const highlights = pick(highlightItems).slice(0, HIGHLIGHT_LIMIT).map((item) => item.value)
  const clips = pick(clipItems).slice(0, CLIP_LIMIT).map((item) => item.value)
  const live = watchable ? [] : pick(liveItems).map((item) => item.value).sort(byImportance).slice(0, LIVE_LIMIT)
  const broadcasts = watchable ? [] : perGame(pick(listingItems).sort((a, b) => (a.value.startUTC ?? "").localeCompare(b.value.startUTC ?? ""))).slice(0, BROADCAST_LIMIT).map((item) => item.value)

  const noVideo = highlightItems.length + clipItems.length === 0
  const { oldest, complete } = storedDayAge(dayOf(0), sport)
  const fresh = oldest !== null && complete && stored !== null && now.getTime() - oldest < STALE_MS
  return {
    state: oldest === null ? "unavailable" : fresh ? "ok" : "stale",
    updatedAt: oldest === null ? null : new Date(oldest).toISOString(),
    competitions: facets.find((facet) => facet.key === "competition")?.options ?? [],
    facets,
    nextGame: sport && noVideo ? await nextGameFor(sport, now) : null,
    live,
    highlights,
    clips,
    broadcasts,
  }
}
