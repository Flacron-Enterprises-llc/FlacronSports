// What the provider reports about a single game. Nothing here is estimated:
// a section the provider does not cover comes back empty and is not shown.

import type { Locale } from "@/lib/i18n"
import { BASKETBALL_PERCENT_STATS, basketballRole, type BasketballRole } from "./adapters/basketball"
import { goalSituation, infractionKey, periodRank, type GoalSituation } from "./adapters/ice-hockey"
import type { EventStatus, ScoreBreakdown, SportEvent, SportId } from "./types"

export type TimelineKind = "goal" | "penalty" | "missed-penalty" | "own-goal" | "yellow" | "red" | "substitution" | "var" | "infraction" | "other"

export interface TimelineItem {
  id: string
  minute: number | null
  kind: TimelineKind
  side: "home" | "away" | null
  player: string | null
  /** The assist, or the other player in a substitution. */
  secondary: string | null
  /** The source's own wording, for a row of kind "other" or "infraction". */
  label?: string
  /** Hockey's period code. Its minutes restart each period, so the two read together. */
  period?: string
  /** Hockey: a goal scored with a player more or fewer. */
  situation?: GoalSituation
  /** Hockey: the infraction's dictionary key, when it has one. */
  infraction?: string
}

export interface StatRow {
  key: string
  /** Null when the source gave a value for one side only. */
  home: string | null
  away: string | null
  /** The source's own name, shown when the dictionary has no term for it. */
  label?: string
}

export type PositionGroup = "goalkeeper" | "defender" | "midfielder" | "forward" | null

export interface LineupPlayer {
  id: string
  /** The player's own record, when the source links one. */
  playerId?: string | null
  name: string
  number: number | null
  group: PositionGroup
  /** Basketball's five positions, which the football groups do not fit. */
  role?: BasketballRole | null
  substitute: boolean
}

export interface MatchDetail {
  state: "ok" | "empty" | "unavailable"
  timeline: TimelineItem[]
  stats: StatRow[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] }
  /** Period scores this game's timeline proves, for a sport whose event record has none. */
  breakdown?: ScoreBreakdown
  fetchedAt: string
}

export interface RawTimeline {
  idTimeline?: string | null
  strTimeline?: string | null
  strTimelineDetail?: string | null
  strHome?: string | null
  strPlayer?: string | null
  strAssist?: string | null
  intTime?: string | number | null
  strPeriod?: string | null
}

export interface RawStat {
  strStat?: string | null
  intHome?: string | number | null
  intAway?: string | number | null
}

export interface RawLineup {
  idLineup?: string | null
  idPlayer?: string | null
  strPlayer?: string | null
  strPosition?: string | null
  strHome?: string | null
  strSubstitute?: string | null
  intSquadNumber?: string | number | null
}

function timelineKind(type: string, detail: string): TimelineKind | null {
  if (!type || type === "unknown") return null
  if (type === "goal") return detail.includes("missed") ? "missed-penalty" : detail.includes("own") ? "own-goal" : detail.includes("penalty") ? "penalty" : "goal"
  if (type === "card") return detail.includes("red") ? "red" : "yellow"
  if (type === "subst") return "substitution"
  return type === "var" ? "var" : "other"
}

const sideOf = (home: string | null | undefined): TimelineItem["side"] => (home === "Yes" ? "home" : home === "No" ? "away" : null)
const whole = (value: string | number | null | undefined) => {
  const parsed = Number(value)
  return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? null : parsed
}

const byStableId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

function hockeyTimeline(rows: RawTimeline[]): TimelineItem[] {
  const items = rows.flatMap((row, index): TimelineItem[] => {
    const type = (row.strTimeline ?? "").trim().toLowerCase()
    const base = { id: row.idTimeline ?? String(index), minute: whole(row.intTime), side: sideOf(row.strHome), player: row.strPlayer || null, secondary: row.strAssist || null, period: (row.strPeriod ?? "").trim().toUpperCase() || undefined }
    if (type === "goal") {
      const situation = goalSituation(row.strTimelineDetail)
      return [{ ...base, kind: "goal", ...(situation ? { situation } : {}) }]
    }
    if (type !== "penalty") return []
    const infraction = infractionKey(row.strTimelineDetail)
    return [{ ...base, kind: "infraction", label: row.strTimelineDetail?.trim() || undefined, ...(infraction ? { infraction } : {}) }]
  })
  return items.sort((a, b) => periodRank(a.period) - periodRank(b.period) || (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER) || byStableId(a.id, b.id))
}

/** Clock first, then the provider's id, so two rows in one minute keep one order on every load. */
export function normalizeTimeline(rows: RawTimeline[] | null | undefined, sport: SportId = "football"): TimelineItem[] {
  if (sport === "ice-hockey") return hockeyTimeline(rows ?? [])
  return (rows ?? [])
    .flatMap((row, index) => {
      const kind = timelineKind((row.strTimeline ?? "").trim().toLowerCase(), (row.strTimelineDetail ?? "").toLowerCase())
      if (!kind) return []
      const item: TimelineItem = { id: row.idTimeline ?? String(index), minute: whole(row.intTime), kind, side: sideOf(row.strHome), player: row.strPlayer || null, secondary: row.strAssist || null }
      return [kind === "other" ? { ...item, label: row.strTimelineDetail?.trim() || (row.strTimeline as string).trim() } : item]
    })
    .sort((a, b) => (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER) || byStableId(a.id, b.id))
}

// The order they read best in. For football, anything else the provider adds is left
// out rather than shown untranslated, since this list is what the French dictionary covers.
const STATS = ["ball possession", "expected_goals", "total shots", "shots on goal", "shots off goal", "blocked shots", "corner kicks", "offsides", "fouls", "yellow cards", "red cards", "goalkeeper saves", "total passes", "passes accurate", "passes %"]

// The source sends these both with and without the sign.
const PERCENT_STATS = new Set(["ball possession", "passes %", ...BASKETBALL_PERCENT_STATS])

const statKey = (name: string) => name.trim().toLowerCase()

const present = (value: string | number | null | undefined) => value !== null && value !== undefined && value !== ""

function statRow(key: string, row: RawStat): StatRow | null {
  if (!present(row.intHome) && !present(row.intAway)) return null
  const shown = (value: string | number | null | undefined) => {
    if (!present(value)) return null
    const text = String(value).trim()
    return PERCENT_STATS.has(key) && !text.endsWith("%") ? `${text}%` : text
  }
  return { key, home: shown(row.intHome), away: shown(row.intAway) }
}

/** Football keeps its curated list. Other sports show what the provider names, in the provider's order. */
export function normalizeStats(rows: RawStat[] | null | undefined, sport: SportId = "football"): StatRow[] {
  if (sport !== "football") {
    return (rows ?? []).flatMap((row) => {
      const name = row.strStat?.trim()
      const stat = name ? statRow(statKey(name), row) : null
      return stat ? [{ ...stat, label: name }] : []
    })
  }
  const known = new Map((rows ?? []).map((row) => [statKey(row.strStat ?? ""), row]))
  return STATS.flatMap((key) => {
    const row = known.get(key)
    const stat = row ? statRow(key, row) : null
    return stat ? [stat] : []
  })
}

// The source writes in English. A label with no term is dropped on other locales rather
// than shown untranslated, as football's curated list already does.
export function labelStats(rows: StatRow[], names: Record<string, string>, locale: Locale): (StatRow & { label: string })[] {
  return rows.flatMap((row) => {
    const label = names[row.key] ?? (locale === "en" ? row.label ?? row.key : null)
    return label ? [{ ...row, label }] : []
  })
}

interface HockeyWords {
  infractions: Record<string, string>
  situations: Record<GoalSituation, string>
}

function kindLabel(item: TimelineItem, kinds: Record<Exclude<TimelineKind, "other">, string>, locale: Locale, hockey?: HockeyWords): string | null | undefined {
  if (item.kind === "other") return locale === "en" ? item.label : null
  if (item.kind === "infraction") {
    const named = (item.infraction && hockey?.infractions[item.infraction]) || (locale === "en" ? item.label : null)
    return named ? `${kinds.infraction}: ${named}` : kinds.infraction
  }
  return item.situation && hockey ? `${kinds[item.kind]} · ${hockey.situations[item.situation]}` : kinds[item.kind]
}

export function labelTimeline(items: TimelineItem[], kinds: Record<Exclude<TimelineKind, "other">, string>, locale: Locale, hockey?: HockeyWords): (TimelineItem & { label: string })[] {
  return items.flatMap((item) => {
    const label = kindLabel(item, kinds, locale, hockey)
    return label ? [{ ...item, label }] : []
  })
}

function positionGroup(position: string | null | undefined): PositionGroup {
  const text = (position ?? "").toLowerCase()
  if (text.includes("goalkeeper")) return "goalkeeper"
  if (text.includes("back") || text.includes("defender")) return "defender"
  if (text.includes("midfield")) return "midfielder"
  if (text.includes("attack") || text.includes("forward") || text.includes("wing") || text.includes("striker")) return "forward"
  return null
}

const GROUP_ORDER = ["goalkeeper", "defender", "midfielder", "forward", null]

export function normalizeLineups(rows: RawLineup[] | null | undefined, sport: SportId = "football"): MatchDetail["lineups"] {
  const basketball = sport === "basketball"
  const side = (home: string) => (rows ?? [])
    .filter((row) => row.strHome === home && row.strPlayer)
    .map((row, index) => ({ id: row.idLineup ?? row.idPlayer ?? String(index), playerId: row.idPlayer ?? null, name: row.strPlayer as string, number: whole(row.intSquadNumber), group: basketball ? null : positionGroup(row.strPosition), ...(basketball ? { role: basketballRole(row.strPosition) } : {}), substitute: row.strSubstitute === "Yes" }))
    .sort((a, b) => Number(a.substitute) - Number(b.substitute) || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
  return { home: side("Yes"), away: side("No") }
}

export type FormResult = "win" | "draw" | "loss"

function resultFor(event: SportEvent, team: string): FormResult | null {
  const side = event.participants.findIndex((participant) => participant.name.toLowerCase() === team.toLowerCase())
  if (side === -1 || event.status !== "finished") return null
  const { score } = event
  if (score.kind === "innings") return score.winner ? (score.winner === event.participants[side].name ? "win" : "loss") : null
  if (score.kind !== "team") return null
  const [own, other] = side === 0 ? [score.home, score.away] : [score.away, score.home]
  if (own !== other) return own > other ? "win" : "loss"
  // Level after a shootout means the source did not say who won it.
  if (event.conclusion !== "penalties" && event.conclusion !== "shootout") return "draw"
  if (!event.shootout) return null
  const [ownKicks, otherKicks] = side === 0 ? [event.shootout.home, event.shootout.away] : [event.shootout.away, event.shootout.home]
  return ownKicks === otherKicks ? null : ownKicks > otherKicks ? "win" : "loss"
}

/** Most recent first. Given a match, only games before it, so an old match page shows the form it had then. */
export function formByGame(recent: SportEvent[], team: string, match?: Pick<SportEvent, "id" | "scheduledStartUTC">, limit = 5): { eventId: string; result: FormResult }[] {
  return recent
    .filter((event) => !match || (event.id !== match.id && (!match.scheduledStartUTC || (event.scheduledStartUTC ?? "") < match.scheduledStartUTC)))
    .sort((a, b) => (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? ""))
    .flatMap((event) => {
      const result = resultFor(event, team)
      return result ? [{ eventId: event.id, result }] : []
    })
    .slice(0, limit)
}

export function teamForm(recent: SportEvent[], team: string, match: Pick<SportEvent, "id" | "scheduledStartUTC">, limit = 5): FormResult[] {
  return formByGame(recent, team, match, limit).map(({ result }) => result)
}

/** The rows around a team, so its page shows its place without the whole table. Empty when it is not listed. */
export function tableAround<T extends { team: string }>(rows: T[], team: string, radius = 2): T[] {
  const wanted = team.toLowerCase()
  const index = rows.findIndex((row) => row.team.toLowerCase() === wanted)
  if (index === -1) return []
  const start = Math.max(0, Math.min(index - radius, rows.length - radius * 2 - 1))
  return rows.slice(start, start + radius * 2 + 1)
}

const LIVE_STALE_MS = 5 * 60_000
const UPCOMING_STALE_MS = 3 * 3_600_000

/** A finished game does not change, so only a game still moving can read as out of date. */
export function isStaleUpdate(status: EventStatus, updatedAt: string | null | undefined, now: number): boolean {
  if (!updatedAt) return false
  const age = now - Date.parse(updatedAt)
  if (status === "live") return age > LIVE_STALE_MS
  return (status === "scheduled" || status === "interrupted") && age > UPCOMING_STALE_MS
}
