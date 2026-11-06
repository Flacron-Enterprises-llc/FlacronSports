import { HOME_SECTIONS, type HomeFeed, type HomeSection } from "@/lib/me/preferences-defaults"
import { competitionRank, groupByCompetition, isMajorCompetition } from "./priority"
import type { SportEvent } from "./types"

/** A section added to the product later joins the end of an older saved order. */
export function resolveHomeFeed(saved: Partial<HomeFeed> | null | undefined): HomeFeed {
  const known = (list: HomeSection[] | undefined) => [...new Set(list ?? [])].filter((section) => HOME_SECTIONS.includes(section))
  const order = known(saved?.order)
  return { order: [...order, ...HOME_SECTIONS.filter((section) => !order.includes(section))], hidden: known(saved?.hidden) }
}

export interface TrendingCompetition {
  key: string
  name: string
  sportId: SportEvent["sportId"]
  live: number
  games: number
}

const TRENDING_LIMIT = 6

/** Counted from today's games: what is live, then the major competitions, then the busiest. */
export function trendingCompetitions(events: SportEvent[], limit = TRENDING_LIMIT): TrendingCompetition[] {
  return groupByCompetition(events)
    .map((group) => ({
      key: group.key,
      name: group.competition.name,
      sportId: group.events[0].sportId,
      live: group.events.filter((event) => event.status === "live").length,
      games: group.events.length,
    }))
    .sort((a, b) => b.live - a.live || Number(isMajorCompetition(b.name)) - Number(isMajorCompetition(a.name)) || competitionRank(a.name) - competitionRank(b.name) || b.games - a.games)
    .slice(0, limit)
}
