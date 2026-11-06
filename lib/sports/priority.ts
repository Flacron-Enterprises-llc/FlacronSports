import type { SportEvent, EventStatus } from "./types"

// A busy Saturday lists over a thousand football fixtures, most of them regional.
// This order decides what a visitor sees first. It hides nothing: every other
// competition still follows, alphabetically, and search reaches all of them.
const MAJOR: RegExp[] = [
  /^FIFA World Cup/i, /^UEFA Champions League/i, /^CAF Champions League/i, /^Africa(n)? Cup of Nations/i,
  /^English Premier League/i, /^Spanish La Liga/i, /^French Ligue 1/i, /^Italian Serie A/i, /^German Bundesliga/i,
  /^UEFA Europa League/i, /^UEFA Conference League/i, /^CAF Confederation Cup/i, /^UEFA Nations League/i,
  /^American Major League Soccer/i, /^Brazilian Serie A/i, /^Argentinian Primera Division/i, /^Saudi-Arabian Pro League/i,
  /^Portuguese Primeira Liga/i, /^Dutch Eredivisie/i, /^English League Championship/i,
  /^Ivory Coast Ligue 1/i, /^Cameroon/i, /^Senegal/i, /^DR Congo Ligue 1/i, /^Nigerian/i, /^South African Premier/i,
  /^NBA\b/i, /^EuroLeague/i, /^WNBA\b/i, /^NHL\b/i, /^NFL\b/i, /^MLB\b/i,
  /^Formula 1/i, /^UFC\b/i, /^ATP\b/i, /^WTA\b/i, /^ICC\b/i, /^Indian Premier League/i, /^Rugby World Cup/i, /^Six Nations/i,
]

const UNRANKED = MAJOR.length

export function competitionRank(name: string): number {
  const found = MAJOR.findIndex((pattern) => pattern.test(name))
  return found === -1 ? UNRANKED : found
}

export const isMajorCompetition = (name: string): boolean => competitionRank(name) < UNRANKED

const ORDER: Record<EventStatus, number> = { live: 0, scheduled: 1, interrupted: 2, finished: 3, postponed: 4, unknown: 5, abandoned: 6, canceled: 7 }

export const byStatusThenTime = (a: SportEvent, b: SportEvent): number =>
  ORDER[a.status] - ORDER[b.status] || (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? "")

/** Notable games first. For views that only have room for a few. */
export const byImportance = (a: SportEvent, b: SportEvent): number =>
  competitionRank(a.competition.name) - competitionRank(b.competition.name) || byStatusThenTime(a, b)

export interface CompetitionGroup {
  key: string
  competition: SportEvent["competition"]
  events: SportEvent[]
}

const groupKey = (event: SportEvent) => `${event.sportId}:${event.competition.id ?? event.competition.name}`

/** Competitions with a live game lead, then the major ones, then the rest by name. */
export function groupByCompetition(events: SportEvent[]): CompetitionGroup[] {
  const groups = new Map<string, CompetitionGroup>()
  for (const event of events) {
    const key = groupKey(event)
    const group = groups.get(key)
    if (group) group.events.push(event)
    else groups.set(key, { key, competition: event.competition, events: [event] })
  }
  const hasLive = (group: CompetitionGroup) => (group.events.some((event) => event.status === "live") ? 0 : 1)
  return [...groups.values()]
    .map((group) => ({ ...group, events: [...group.events].sort(byStatusThenTime) }))
    .sort((a, b) => hasLive(a) - hasLive(b) || competitionRank(a.competition.name) - competitionRank(b.competition.name) || a.competition.name.localeCompare(b.competition.name))
}

/** A page of games, kept under their competition headings. */
export function pageOfGroups(groups: CompetitionGroup[], page: number, pageSize: number): CompetitionGroup[] {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  let seen = 0
  return groups.flatMap((group) => {
    const from = Math.max(start - seen, 0)
    const to = Math.min(end - seen, group.events.length)
    seen += group.events.length
    return from < to ? [{ ...group, events: group.events.slice(from, to) }] : []
  })
}
