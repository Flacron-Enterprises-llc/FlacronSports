// A game airs on several channels, and the feed lists one row for each. People look for the
// game first and the channel second, so the rows are gathered under the game they belong to.

import type { Broadcast } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"

export interface ListingGroup {
  key: string
  matchId: string | null
  eventName: string
  sportId: SportId
  startUTC: string | null
  channels: Broadcast[]
}

/** Keeps the order it is given, so a viewer's own country still leads. */
export function groupListings(broadcasts: Broadcast[]): ListingGroup[] {
  const groups = new Map<string, ListingGroup>()
  for (const item of broadcasts) {
    const key = item.matchId ?? `${item.eventName}|${item.startUTC ?? ""}`
    const group = groups.get(key) ?? { key, matchId: item.matchId, eventName: item.eventName, sportId: item.sportId, startUTC: item.startUTC, channels: [] }
    if (!group.channels.some((channel) => channel.channel === item.channel && channel.country === item.country)) group.channels.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}
