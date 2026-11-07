import { listPublishedReports } from "@/lib/content/reports"
import type { Locale } from "@/lib/i18n"
import { AFRICAN_NATIONS, isAfricanCompetition, isAfricanEvent } from "@/lib/sports/africa"
import type { PlayerProfile } from "@/lib/sports/player"
import { byImportance } from "@/lib/sports/priority"
import { allCompetitions, getEvents, searchPlayers, searchTeams } from "@/lib/sports/service"
import type { EventFeed, SportEvent, SportId } from "@/lib/sports/types"
import { competitionsToday, containsText, eventMatches, type CompetitionHit } from "./match"

const FIXTURE_LIMIT = 12
const LIST_LIMIT = 10
const AFRICA_FIXTURE_LIMIT = 6
const AFRICA_COMPETITION_LIMIT = 12

export interface SearchReport {
  id: string
  slug: string
  title: string
  competition: string
  publishedAt: string | null
}

export interface SearchResults {
  query: string
  teams: { name: string; sportId: SportId }[]
  fixtures: SportEvent[]
  competitions: CompetitionHit[]
  players: PlayerProfile[]
  reports: SearchReport[]
  africa: { teams: string[]; competitions: CompetitionHit[]; fixtures: SportEvent[] }
  feedState: EventFeed["state"]
  /** Something could not be reached, so the lists above may be missing entries. */
  partial: boolean
  fetchedAt: string
}

function mergeCompetitions(today: CompetitionHit[], known: CompetitionHit[]): CompetitionHit[] {
  const seen = new Set(today.map((item) => item.id))
  return [...today, ...known.filter((item) => !seen.has(item.id))]
}

function africaSection(feed: EventFeed, known: CompetitionHit[], needle: string): SearchResults["africa"] {
  const fixtures = feed.events.filter((event) => isAfricanEvent(event) && (!needle || eventMatches(event, needle))).sort(byImportance).slice(0, AFRICA_FIXTURE_LIMIT)
  const today = competitionsToday(feed.events, (name, country) => isAfricanCompetition(name, country) && (!needle || containsText(name, needle)))
  return {
    teams: AFRICAN_NATIONS.filter((name) => !needle || containsText(name, needle)),
    competitions: mergeCompetitions(today, known.filter((item) => isAfricanCompetition(item.name) && (!needle || containsText(item.name, needle)))).slice(0, AFRICA_COMPETITION_LIMIT),
    fixtures,
  }
}

/** One unreachable source costs its own section, never the whole page. */
export async function globalSearch(query: string, locale: Locale, sport?: SportId): Promise<SearchResults> {
  const needle = query.trim()
  const named = needle.length >= 2
  const [feed, catalogue, teams, players, reports] = await Promise.allSettled([
    getEvents({ sport }),
    allCompetitions(),
    named ? searchTeams(needle, sport) : Promise.resolve([]),
    named ? searchPlayers(needle) : Promise.resolve([]),
    named ? listPublishedReports(locale) : Promise.resolve({ state: "ok" as const, reports: [] }),
  ])

  const events: EventFeed = feed.status === "fulfilled" ? feed.value : { state: "unavailable", events: [], source: "", fetchedAt: new Date().toISOString(), limited: false }
  const inSport = <T extends { sportId: SportId }>(items: T[]) => items.filter((item) => !sport || item.sportId === sport)
  const known = catalogue.status === "fulfilled" ? inSport(catalogue.value).map(({ id, name, sportId }) => ({ id, name, sportId, today: 0 })) : []
  const listed = catalogue.status === "fulfilled" ? inSport(catalogue.value) : []
  const hits = listed.filter((item) => containsText(item.name, needle) || containsText(item.alternate ?? "", needle)).map(({ id, name, sportId }) => ({ id, name, sportId, today: 0 }))

  const reportList = reports.status === "fulfilled" ? reports.value : { state: "unavailable" as const, reports: [] }
  const matchingReports = reportList.reports.filter((report) => [report.title, report.competition, ...report.participants].some((text) => containsText(text, needle)))

  return {
    query: needle,
    teams: named && teams.status === "fulfilled" ? inSport(teams.value) : [],
    fixtures: named ? events.events.filter((event) => eventMatches(event, needle)).sort(byImportance).slice(0, FIXTURE_LIMIT) : [],
    competitions: named ? mergeCompetitions(competitionsToday(events.events, (name) => containsText(name, needle)), hits).slice(0, LIST_LIMIT) : [],
    players: named && players.status === "fulfilled" ? inSport(players.value) : [],
    reports: named ? matchingReports.slice(0, LIST_LIMIT).map(({ id, slug, title, competition, publishedAt }) => ({ id, slug, title, competition, publishedAt })) : [],
    africa: africaSection(events, known, named ? needle : ""),
    feedState: events.state,
    partial: events.state !== "ok" || [catalogue, teams, players].some((result) => result.status === "rejected") || reportList.state === "unavailable",
    fetchedAt: events.fetchedAt,
  }
}
