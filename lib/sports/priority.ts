import type { EventStatus, SportEvent, SportId } from "./types"

// A busy Saturday lists over a thousand football fixtures, most of them regional.
// This order decides what a visitor sees first. It hides nothing: every other
// competition still follows, alphabetically, and search reaches all of them.
// Names are the feed's own, checked against its league list, so "NBA G League" and
// "MLB Spring Training" stay out. Grand Slams have no league of their own there: they
// arrive under the two tours.
const MAJOR_BY_SPORT: Record<SportId, RegExp[]> = {
  football: [
    /^FIFA World Cup/i, /^UEFA Champions League/i, /^CAF Champions League/i, /^Africa(n)? Cup of Nations/i,
    /^English Premier League/i, /^Spanish La Liga/i, /^French Ligue 1/i, /^Italian Serie A/i, /^German Bundesliga/i,
    /^UEFA Europa League/i, /^UEFA Conference League/i, /^CAF Confederation Cup/i, /^UEFA Nations League/i,
    /^American Major League Soccer/i, /^Brazilian Serie A/i, /^Argentinian Primera Division/i, /^Saudi-Arabian Pro League/i,
    /^Portuguese Primeira Liga/i, /^Dutch Eredivisie/i, /^English League Championship/i,
    /^Ivory Coast Ligue 1/i, /^Cameroon/i, /^Senegal/i, /^DR Congo Ligue 1/i, /^Nigerian/i, /^South African Premier/i,
  ],
  basketball: [
    /^NBA$/i, /^NBA Cup$/i, /^EuroLeague Basketball/i, /^WNBA$/i, /^FIBA Basketball World Cup/i, /^FIBA EuroBasket/i,
    /^EuroCup Basketball/i, /^Basketball Champions League/i, /^EuroLeague Women/i, /^Basketball Africa League/i, /^FIBA AmeriCup/i,
    /^NCAA Division I Basketball/i, /^Spanish Liga ACB/i, /^French LNB$/i, /^Italian Lega Basket/i, /^German BBL$/i, /^Turkish Basketbol Super Ligi/i, /^Greek Basket League/i,
    /^Australian NBL/i, /^Chinese CBA/i,
  ],
  "american-football": [/^NFL\b/i, /^NCAA Division 1 Football/i, /^CFL\b/i, /^UFL\b/i, /^European League of Football/i],
  baseball: [
    /^MLB$/i, /^World Baseball Classic/i, /^Korean KBO League/i, /^Nippon Baseball League/i, /^Caribbean Series/i,
    /^Mexican Pacific League/i, /^Venezuelan Professional Baseball League/i, /^Liga de Béisbol Profesional Roberto Clemente/i, /^Liga Mexicana de Béisbol/i,
  ],
  "ice-hockey": [
    /^NHL\b/i, /^Russian KHL/i, /^Mens Ice Hockey World Championships$/i, /^Olympics Ice Hockey/i, /^Champions Hockey League/i,
    /^Swedish Hockey League/i, /^Finnish Liiga/i, /^Swiss National League/i, /^Czech Extraliga/i, /^German DEL$/i, /^French Ligue Magnus/i,
    /^American AHL/i, /^NCAA Division 1 Ice Hockey/i,
  ],
  tennis: [/^ATP\b/i, /^WTA\b/i, /^Davis Cup/i, /^Fed Cup/i, /^Laver Cup/i, /^United Cup/i, /^Olympics Tennis/i],
  cricket: [
    /^ICC\b/i, /^Cricket World Cup/i, /^Womens Cricket World Cup/i, /^International Test Match Series/i, /^One Day International Series/i, /^Twenty20 International Series/i,
    /^Indian Premier League/i, /^Australian Big Bash League/i, /^The Hundred/i, /^Pakistan Super League/i, /^SA20/i, /^Caribbean Premier League/i,
    /^International League T20/i, /^Major League Cricket/i, /^Bangladesh Premier League/i, /^English County Championship Division 1/i, /^English t20 Blast/i, /^Sheffield Shield/i,
  ],
  rugby: [
    /^Rugby World Cup/i, /^Six Nations Championship/i, /^Six Nations Women/i, /^Rugby Championship/i, /^Nations Championship/i, /^World Rugby Nations Cup/i, /^Autumn Nations Cup/i,
    /^British and Irish Lions Tours/i, /^European Rugby Champions Cup/i, /^European Rugby Challenge Cup/i, /^French Top 14/i, /^English Prem Rugby$/i, /^United Rugby Championship/i,
    /^Super Rugby$/i, /^Rugby Africa Cup/i, /^Pacific Nations Cup/i, /^Currie Cup/i, /^Japan Rugby League One/i, /^French Pro D2/i,
    /^Rugby League World Cup/i, /^Australian National Rugby League/i, /^English Rugby League Super League/i, /^State of Origin/i,
  ],
  volleyball: [
    /^CEV Champions League/i, /^CEV Cup/i, /^CEV Challenge Cup/i, /^FIVB\b/i, /^Olympics Volleyball/i, /^(Mens|Womens) European Volleyball Championship/i,
    /^Italian Volleyball League/i, /^Italian Womens Volleyball League/i, /^Polish PlusLiga/i, /^Turkish Volleyball League/i, /^French Ligue A (Mens|Womens) Volleyball/i,
    /^German 1\. Bundesliga/i, /^Russian Volleyball Super League/i, /^Korean (Womens )?V-League/i,
  ],
  "combat-sports": [/^UFC\b/i, /^Professional Fighters League/i, /^PFL\b/i, /^ONE$/i, /^Boxing$/i, /^Bellator/i, /^BKFC/i, /^Glory/i, /^Rizin/i, /^KSW/i, /^Oktagon MMA/i, /^Cage Warriors/i],
  motorsport: [
    /^Formula 1/i, /^MotoGP/i, /^NASCAR Cup Series/i, /^IndyCar Series/i, /^WEC$/i, /^WRC$/i, /^Formula E/i, /^Formula 2/i, /^Moto2/i, /^Moto3/i,
    /^V8 Supercars/i, /^SBK$/i, /^IMSA SportsCar Championship/i, /^DTM$/i, /^Super GT series/i, /^Dakar Rally/i, /^NASCAR (Xfinity|O'Reilly Auto Parts) Series/i, /^NASCAR Truck Series/i,
  ],
}

const MAJOR = Object.values(MAJOR_BY_SPORT).flat()

const UNRANKED = MAJOR.length

export function competitionRank(name: string): number {
  const found = MAJOR.findIndex((pattern) => pattern.test(name))
  return found === -1 ? UNRANKED : found
}

export const isMajorCompetition = (name: string): boolean => competitionRank(name) < UNRANKED

/** Rank within one sport, so a name that means something else in another sport cannot count. */
function rankIn(sportId: SportId, name: string): number {
  const found = MAJOR_BY_SPORT[sportId].findIndex((pattern) => pattern.test(name))
  return found === -1 ? UNRANKED : found
}

export const isMajorIn = (sportId: SportId, name: string): boolean => rankIn(sportId, name) < UNRANKED

/** One item from each group in turn, keeping each group's order. */
export function interleave<T>(items: T[], groupOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(groupOf(item), [...(groups.get(groupOf(item)) ?? []), item])
  const lists = [...groups.values()]
  const longest = Math.max(0, ...lists.map((list) => list.length))
  return Array.from({ length: longest }, (_, turn) => lists.flatMap((list) => (turn < list.length ? [list[turn]] : []))).flat()
}

/** Written reports a sport can take in one UTC day. The cap is what keeps football from filling the news. */
export const DAILY_REPORTS_PER_SPORT = 40
/** A sport this short of major games is topped up from its other competitions, so it stays in the news off season. */
export const DAILY_REPORTS_FLOOR = 8

const reportDay = (event: SportEvent) => event.scheduledStartUTC?.slice(0, 10) ?? ""

/**
 * Which games get a written report: each sport and day is chosen on its own, taking
 * every major competition in turn up to the quota. The order ignores status, so a game
 * keeps its place from preview to result. Football has no top-up: its regional fixtures
 * run to the hundreds. `isWanted` games are always in and take no place in the quota.
 */
export function selectForReports(events: SportEvent[], isWanted: (event: SportEvent) => boolean): SportEvent[] {
  const days = new Map<string, SportEvent[]>()
  const kept = new Set<string>()
  for (const event of events) {
    if (isWanted(event)) kept.add(event.id)
    else {
      const key = `${event.sportId}|${reportDay(event)}`
      days.set(key, [...(days.get(key) ?? []), event])
    }
  }
  const competition = (event: SportEvent) => event.competition.id ?? event.competition.name
  for (const games of days.values()) {
    const { sportId } = games[0]
    const stable = [...games].sort((a, b) =>
      rankIn(sportId, a.competition.name) - rankIn(sportId, b.competition.name) ||
      competition(a).localeCompare(competition(b)) ||
      (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? "") ||
      a.id.localeCompare(b.id))
    const major = interleave(stable.filter((event) => isMajorIn(sportId, event.competition.name)), competition).slice(0, DAILY_REPORTS_PER_SPORT)
    const room = sportId === "football" ? 0 : Math.max(0, DAILY_REPORTS_FLOOR - major.length)
    const others = interleave(stable.filter((event) => !isMajorIn(sportId, event.competition.name)), competition).slice(0, room)
    for (const event of [...major, ...others]) kept.add(event.id)
  }
  return events.filter((event) => kept.has(event.id))
}

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
