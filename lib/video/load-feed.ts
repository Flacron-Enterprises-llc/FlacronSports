import { MemberAccessRequired } from "@/lib/member-fetch"
import { fromBackend } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"
import { getWatchFeed, type WatchFeed, type WatchFilters } from "./catalog"

const EMPTY: WatchFeed = { live: [], highlights: [], clips: [], broadcasts: [] }

/** Pages on the frontend reach the feed through the backend, like every other member view. */
export async function loadWatchFeed(sport: SportId | undefined, filters: WatchFilters): Promise<{ feed: WatchFeed; failed: boolean; withheld: boolean }> {
  const { watchable, ...rest } = filters
  const fields = { sport, ...rest, watchable: watchable ? "1" : undefined }
  const query = new URLSearchParams(Object.entries(fields).flatMap(([key, value]) => (value ? [[key, value]] : []))).toString()
  const request = process.env.API_ORIGIN ? fromBackend<WatchFeed>(`/api/watch${query ? `?${query}` : ""}`) : getWatchFeed(sport, new Date(), filters)
  let withheld = false
  const feed = await request.catch((error) => {
    withheld = error instanceof MemberAccessRequired
    return null
  })
  return { feed: feed ?? EMPTY, failed: !feed || feed.state === "unavailable", withheld }
}
