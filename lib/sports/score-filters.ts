import type { Preferences } from "@/lib/me/preferences-defaults"
import { isFollowed, type Following } from "./following"
import { groupByCompetition } from "./priority"
import type { SportEvent } from "./types"

// A CDN refuses an address past 8 KB, and only a very long follow list gets near this.
const MAX_FILTER_CHARS = 6000
const SEPARATOR = "|"

export interface FollowFilter {
  fav: string
  favl: string
}

/** What Scores needs in its address. The server has no signed-in user, so the page says who is followed. */
export function followFilter(prefs: Pick<Preferences, "favorites" | "leagues" | "players">): FollowFilter {
  const names = [...new Set([...prefs.favorites, ...prefs.players.flatMap((player) => (player.team ? [player.team] : []))])]
  const leagues = prefs.leagues.map((league) => league.id)
  const kept: string[] = []
  let used = encodeURIComponent(leagues.join(SEPARATOR)).length
  for (const name of names) {
    used += encodeURIComponent(name + SEPARATOR).length
    if (used > MAX_FILTER_CHARS) break
    kept.push(name)
  }
  return { fav: kept.join(SEPARATOR), favl: leagues.join(SEPARATOR) }
}

export function parseFollowFilter(fav: string | undefined, favl: string | undefined): Following | null {
  if (!fav && !favl) return null
  return {
    favorites: (fav ?? "").split(SEPARATOR).filter(Boolean),
    players: [],
    leagues: (favl ?? "").split(SEPARATOR).filter(Boolean).map((id) => ({ id, name: "", sportId: "" })),
  }
}

export function competitionOptions(events: SportEvent[]) {
  return groupByCompetition(events).map((group) => ({ key: group.key, name: group.competition.name }))
}

interface ScoreFilters {
  q: string
  competition?: string
  following: Following | null
}

/** Applied before paging, so every page and tab count agrees with the filters. */
export function filterScores(events: SportEvent[], { q, competition, following }: ScoreFilters): SportEvent[] {
  const chosen = competition ? groupByCompetition(events).find((group) => group.key === competition)?.events : undefined
  const needle = q.toLowerCase()
  return (chosen ?? events).filter((event) => {
    if (following && !isFollowed(following, event)) return false
    return !needle || [event.competition.name, event.eventName ?? "", ...event.participants.map((participant) => participant.name)].some((text) => text.toLowerCase().includes(needle))
  })
}
