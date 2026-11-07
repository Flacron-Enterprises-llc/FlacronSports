import { createHash } from "node:crypto"
import { readSnapshot, storedEvents, utcDate, writeSnapshot } from "@/lib/sports/service"
import type { EventStatus, SportEvent } from "@/lib/sports/types"
import { findGame } from "./clip-match"

const FEED_URL = "https://www.scorebat.com/video-api/v3/feed/"
const SNAPSHOT_KEY = "scorebat:feed"
// Every call spends quota, so one job refreshes a stored copy and visitors read that.
// The spec's plan is 5,000 credits a month: five for a feed call, one for a video view. Two hours is
// 360 calls, 1,800 credits, which leaves the rest for viewing. The feed sends no quota headers.
const REFRESH_MS = 2 * 3_600_000
const SHOW_LIMIT_MS = 7 * 86_400_000
const MEMORY_MS = 5 * 60_000
const TIMEOUT_MS = 15_000
const DAY_MS = 86_400_000
// A stream is offered from just before kick-off to the end of a game with extra time and a delay.
const STREAM_OPENS_MS = 30 * 60_000
const STREAM_CLOSES_MS = 4 * 3_600_000
const EMBED_SRC = /src=['"](https:\/\/www\.scorebat\.com\/embed\/v\/[\w=-]+\/?(?:\?[\w=&%+.-]*)?)['"]/
const MATCH_VIEW = /^https:\/\/www\.scorebat\.com\/embed\/matchview\/\d+\/?(?:\?[\w=&%+.-]*)?$/
const GOAL_TITLE = /^\d+\s*-\s*\d+\b/
const LIVE_TITLE = /^live\s*stream/i

interface RawVideo {
  id?: string
  title?: string
  embed?: string
}

interface RawTeam {
  name?: string
}

export interface RawClip {
  title?: string
  competition?: string
  matchviewUrl?: string
  thumbnail?: string
  date?: string
  homeTeam?: RawTeam
  awayTeam?: RawTeam
  videos?: RawVideo[]
}

/** "match" is the provider's full match page. It states the result, so it is never a lead video. */
export type ClipKind = "highlight" | "goal" | "live" | "match"

/** What a page may hold. The player address carries an embed token, so it stays on the server. */
export interface ClipVideo {
  id: string
  kind: ClipKind
  label: string
}

export interface StoredVideo extends ClipVideo {
  embedUrl: string
}

export interface Clip {
  id: string
  title: string
  competition: string
  thumbnailUrl: string | null
  dateUTC: string | null
  /** The site's own game. Absent on a reply from a backend older than this field. */
  matchId?: string | null
  /** Every highlight and goal of the game, the lead one included. */
  videos?: ClipVideo[]
}

/** The game as this site names it, so filters and pages show one name for it. */
export interface ClipGameNames {
  competition: string
  teams: string[]
}

export interface StoredClip extends Omit<Clip, "videos"> {
  embedUrl: string
  home?: string
  away?: string
  game?: ClipGameNames
  videos?: StoredVideo[]
}

const shortHash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 16)

const kindOf = (title: string | undefined): ClipKind => (GOAL_TITLE.test(title ?? "") ? "goal" : LIVE_TITLE.test(title ?? "") ? "live" : "highlight")

function toVideos(row: RawClip): StoredVideo[] {
  const videos = (row.videos ?? []).flatMap((video) => {
    const embedUrl = video.embed?.match(EMBED_SRC)?.[1]
    return embedUrl && video.id ? [{ id: shortHash(video.id), kind: kindOf(video.title), label: video.title ?? "", embedUrl }] : []
  })
  const page = row.matchviewUrl
  return page && MATCH_VIEW.test(page) ? [...videos, { id: shortHash(page.split("?")[0]), kind: "match" as const, label: "", embedUrl: page }] : videos
}

/** A row can list only a live stream, and that must not pass for a highlight. */
const leadOf = (videos: StoredVideo[]) => videos.find((video) => video.kind === "highlight") ?? videos.find((video) => video.kind === "goal") ?? videos.find((video) => video.kind === "live")

/** Keeps only provider player addresses, so raw embed HTML never reaches a page. */
export function normalizeClips(rows: RawClip[] | null | undefined): StoredClip[] {
  return (rows ?? []).flatMap((row) => {
    const videos = toVideos(row)
    const lead = leadOf(videos)
    if (!lead || !row.title) return []
    const date = row.date ? new Date(row.date) : null
    return [{
      id: lead.id,
      title: row.title,
      competition: row.competition ?? "",
      thumbnailUrl: row.thumbnail?.startsWith("https://") ? row.thumbnail : null,
      dateUTC: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      embedUrl: lead.embedUrl,
      home: row.homeTeam?.name,
      away: row.awayTeam?.name,
      videos,
    }]
  })
}

/** Copies stored before a clip held all its videos have just the one. */
export const clipVideos = (clip: StoredClip): StoredVideo[] => clip.videos ?? [{ id: clip.id, kind: "highlight", label: "Highlights", embedUrl: clip.embedUrl }]

export const pageVideo = ({ id, kind, label }: StoredVideo): ClipVideo => ({ id, kind, label })

const GONE = new Set<EventStatus | undefined>(["finished", "postponed", "canceled", "abandoned"])

/**
 * The feed keeps "Live Stream" entries long after a game ends, and one seen on a finished game
 * played a youth match instead. So one is offered only while its game can really be on.
 */
export function streamOpen(dateUTC: string | null, status: EventStatus | undefined, now: number): boolean {
  const start = dateUTC ? Date.parse(dateUTC) : Number.NaN
  return now >= start - STREAM_OPENS_MS && now <= start + STREAM_CLOSES_MS && !GONE.has(status)
}

/** Each clip's day and the days beside it, because the feeds can differ on the day of a late game. */
async function gamesAround(clips: StoredClip[]): Promise<SportEvent[]> {
  const dates = new Set(clips.flatMap(({ dateUTC }) => (dateUTC ? [-1, 0, 1].map((offset) => utcDate(new Date(Date.parse(dateUTC) + offset * DAY_MS))) : [])))
  return (await Promise.all([...dates].map((date) => storedEvents(date, "football").catch(() => [])))).flat()
}

/** A game missing from the store this time keeps the link it already had. */
export function linkClips(clips: StoredClip[], games: SportEvent[], known: StoredClip[] = []): StoredClip[] {
  const earlier = new Map(known.map((clip) => [clip.id, clip]))
  return clips.map((clip) => {
    const game = findGame({ home: clip.home ?? "", away: clip.away ?? "", competition: clip.competition, dateUTC: clip.dateUTC }, games)
    if (game) return { ...clip, matchId: game.id, game: { competition: game.competition.name, teams: game.participants.map((item) => item.name) } }
    const before = earlier.get(clip.id)
    return before?.matchId ? { ...clip, matchId: before.matchId, game: before.game } : { ...clip, matchId: null }
  })
}

let memory: { clips: StoredClip[]; at: number } | null = null

export function clearClipCache(): void {
  memory = null
}

export async function storedClips(now: number = Date.now()): Promise<StoredClip[]> {
  if (memory && now - memory.at < MEMORY_MS) return memory.clips
  const snapshot = await readSnapshot(SNAPSHOT_KEY)
  const clips = snapshot && now - snapshot.at < SHOW_LIMIT_MS ? (snapshot.data as StoredClip[]) : []
  memory = { clips, at: now }
  return clips
}

/** Newest first, so a same-day clip is never cut off behind older ones. Undated clips go last. */
export const newestFirst = <T extends Pick<Clip, "dateUTC">>(clips: T[]): T[] =>
  [...clips].sort((a, b) => (b.dateUTC ?? "").localeCompare(a.dateUTC ?? ""))

/** Called by the scheduled job only. The error never carries the address, which holds the token. */
export async function refreshClips(now: number = Date.now()): Promise<string> {
  const token = process.env.SCOREBAT_TOKEN
  if (!token) return "disabled"
  const snapshot = await readSnapshot(SNAPSHOT_KEY)
  if (snapshot && now - snapshot.at < REFRESH_MS) return "fresh"
  try {
    const response = await fetch(`${FEED_URL}?token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" })
    if (!response.ok) return `failed_${response.status}`
    const clips = normalizeClips(((await response.json()) as { response?: RawClip[] }).response)
    if (clips.length === 0) return "empty"
    const linked = linkClips(clips, await gamesAround(clips), (snapshot?.data as StoredClip[] | undefined) ?? [])
    await writeSnapshot(SNAPSHOT_KEY, linked, now)
    memory = { clips: linked, at: now }
    return `stored_${linked.length}`
  } catch {
    return "failed"
  }
}
