import type { Preferences } from "@/lib/me/preferences-defaults"
import { isFollowed, type Following } from "./following"
import { groupByCompetition } from "./priority"
import type { CricketFormat, MotorsportSession, SportEvent, SportId } from "./types"

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
  kind?: string
}

/** Cricket always offers every format, so a day with one format still leads to the others. */
export const CRICKET_KINDS: CricketFormat[] = ["test", "odi", "t20", "first-class", "hundred"]
const SESSION_KINDS: Record<MotorsportSession, string> = { race: "race", sprint: "race", qualifying: "qualifying", "sprint-qualifying": "qualifying", practice: "practice", testing: "practice", stage: "stage" }

/** What a sport splits into beyond its competitions: a cricket format, a tennis draw, a race weekend session. */
export function kindOf(event: Pick<SportEvent, "details">): string | null {
  const { details } = event
  if (details?.kind === "cricket") return details.format
  if (details?.kind === "combat") return details.discipline
  if (details?.kind === "rugby") return details.code
  if (details?.kind === "tennis") return details.format === "team-tie" ? "team-tie" : details.gender === "mixed" ? "mixed" : details.format === "doubles" ? `${details.gender ?? "any"}-doubles` : details.gender
  if (details?.kind === "motorsport") return SESSION_KINDS[details.session]
  return null
}

export interface KindOption {
  key: string
  count: number
}

export function kindOptions(sport: SportId | undefined, events: Pick<SportEvent, "details">[]): KindOption[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    const kind = kindOf(event)
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  if (sport === "cricket") return CRICKET_KINDS.map((key) => ({ key, count: counts.get(key) ?? 0 }))
  return counts.size > 1 ? [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count })) : []
}

/** Applied before paging, so every page and tab count agrees with the filters. */
export function filterScores(events: SportEvent[], { q, competition, following, kind }: ScoreFilters): SportEvent[] {
  const chosen = competition ? groupByCompetition(events).find((group) => group.key === competition)?.events : undefined
  const needle = q.toLowerCase()
  return (chosen ?? events).filter((event) => {
    if (following && !isFollowed(following, event)) return false
    if (kind && kindOf(event) !== kind) return false
    return !needle || [event.competition.name, event.eventName ?? "", ...event.participants.map((participant) => participant.name)].some((text) => text.toLowerCase().includes(needle))
  })
}
