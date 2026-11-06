import { createHash } from "node:crypto"
import { readSnapshot, writeSnapshot } from "@/lib/sports/service"

const FEED_URL = "https://www.scorebat.com/video-api/v3/feed/"
const SNAPSHOT_KEY = "scorebat:feed"
// Every call spends quota, so one job refreshes a stored copy and visitors read that.
const REFRESH_MS = 6 * 3_600_000
const SHOW_LIMIT_MS = 7 * 86_400_000
const MEMORY_MS = 5 * 60_000
const TIMEOUT_MS = 15_000
const EMBED_SRC = /src=['"](https:\/\/www\.scorebat\.com\/embed\/v\/[\w=-]+\/?(?:\?[\w=&%+.-]*)?)['"]/

interface RawVideo {
  id?: string
  title?: string
  embed?: string
}

interface RawClip {
  title?: string
  competition?: string
  thumbnail?: string
  date?: string
  videos?: RawVideo[]
}

export interface Clip {
  id: string
  title: string
  competition: string
  thumbnailUrl: string | null
  dateUTC: string | null
}

export interface StoredClip extends Clip {
  embedUrl: string
}

/** Keeps only a provider player address, so raw embed HTML never reaches a page. */
export function normalizeClips(rows: RawClip[] | null | undefined): StoredClip[] {
  return (rows ?? []).flatMap((row) => {
    const video = row.videos?.find((item) => item.title === "Highlights") ?? row.videos?.[0]
    const embedUrl = video?.embed?.match(EMBED_SRC)?.[1]
    if (!embedUrl || !video?.id || !row.title) return []
    const date = row.date ? new Date(row.date) : null
    return [{
      id: createHash("sha1").update(video.id).digest("hex").slice(0, 16),
      title: row.title,
      competition: row.competition ?? "",
      thumbnailUrl: row.thumbnail?.startsWith("https://") ? row.thumbnail : null,
      dateUTC: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      embedUrl,
    }]
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
    await writeSnapshot(SNAPSHOT_KEY, clips, now)
    memory = { clips, at: now }
    return `stored_${clips.length}`
  } catch {
    return "failed"
  }
}
