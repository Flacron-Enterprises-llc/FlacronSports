// The games a member can act on from the predictions and rooms pages.

import { followPriority, isFollowed, type Following } from "@/lib/sports/following"
import { eventTitle } from "@/lib/sports/presentation"
import { isMajorCompetition } from "@/lib/sports/priority"
import type { SportEvent } from "@/lib/sports/types"
import { predictionKind, predictionOpen } from "./predictions"

export interface UpcomingGame {
  id: string
  title: string
  competition: string
  kickoffUTC: string
  followed: boolean
  predictable: boolean
}

const MAX_GAMES = 200

/** Followed games first in the member's own order, then major competitions, each soonest first. */
export function rankUpcoming(events: SportEvent[], following: Following, now: Date, limit = MAX_GAMES): UpcomingGame[] {
  const seen = new Set<string>()
  const start = (event: SportEvent) => event.scheduledStartUTC as string
  return events
    .filter((event) => {
      if (seen.has(event.id) || event.status !== "scheduled" || event.dateOnly || !event.scheduledStartUTC) return false
      if (Date.parse(event.scheduledStartUTC) <= now.getTime() || event.participants.some((participant) => participant.name === "TBD")) return false
      seen.add(event.id)
      return true
    })
    .sort((a, b) =>
      followPriority(following, a) - followPriority(following, b)
      || Number(isMajorCompetition(b.competition.name)) - Number(isMajorCompetition(a.competition.name))
      || start(a).localeCompare(start(b)))
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      title: eventTitle(event),
      competition: event.competition.name,
      kickoffUTC: start(event),
      followed: isFollowed(following, event),
      predictable: Boolean(predictionKind(event)) && predictionOpen(event, now),
    }))
}
