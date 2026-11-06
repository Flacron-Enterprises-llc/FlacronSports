// What the provider reports about a single game. Nothing here is estimated:
// a section the provider does not cover comes back empty and is not shown.

export type TimelineKind = "goal" | "penalty" | "own-goal" | "yellow" | "red" | "substitution" | "var"

export interface TimelineItem {
  id: string
  minute: number | null
  kind: TimelineKind
  side: "home" | "away" | null
  player: string | null
  /** The assist, or the other player in a substitution. */
  secondary: string | null
}

export interface StatRow {
  key: string
  home: string
  away: string
}

export type PositionGroup = "goalkeeper" | "defender" | "midfielder" | "forward" | null

export interface LineupPlayer {
  id: string
  name: string
  number: number | null
  group: PositionGroup
  substitute: boolean
}

export interface MatchDetail {
  state: "ok" | "empty" | "unavailable"
  timeline: TimelineItem[]
  stats: StatRow[]
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] }
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
  if (type === "goal") return detail.includes("own") ? "own-goal" : detail.includes("penalty") ? "penalty" : "goal"
  if (type === "card") return detail.includes("red") ? "red" : "yellow"
  if (type === "subst") return "substitution"
  if (type === "var") return "var"
  return null
}

const sideOf = (home: string | null | undefined) => (home === "Yes" ? "home" : home === "No" ? "away" : null)
const whole = (value: string | number | null | undefined) => {
  const parsed = Number(value)
  return value === null || value === undefined || value === "" || !Number.isFinite(parsed) ? null : parsed
}

export function normalizeTimeline(rows: RawTimeline[] | null | undefined): TimelineItem[] {
  return (rows ?? [])
    .flatMap((row, index) => {
      const kind = timelineKind((row.strTimeline ?? "").toLowerCase(), (row.strTimelineDetail ?? "").toLowerCase())
      if (!kind) return []
      return [{ id: row.idTimeline ?? String(index), minute: whole(row.intTime), kind, side: sideOf(row.strHome), player: row.strPlayer || null, secondary: row.strAssist || null } as TimelineItem]
    })
    .sort((a, b) => (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER))
}

// The order they read best in. Anything else the provider adds is left out rather
// than shown untranslated, since this list is what the French dictionary covers.
const STATS = ["ball possession", "expected_goals", "total shots", "shots on goal", "shots off goal", "blocked shots", "corner kicks", "offsides", "fouls", "yellow cards", "red cards", "goalkeeper saves", "total passes", "passes accurate", "passes %"]

const statKey = (name: string) => name.trim().toLowerCase()

export function normalizeStats(rows: RawStat[] | null | undefined): StatRow[] {
  const known = new Map((rows ?? []).map((row) => [statKey(row.strStat ?? ""), row]))
  return STATS.flatMap((key) => {
    const row = known.get(key)
    if (!row) return []
    const present = (value: string | number | null | undefined) => value !== null && value !== undefined && value !== ""
    if (!present(row.intHome) && !present(row.intAway)) return []
    return [{ key, home: present(row.intHome) ? String(row.intHome) : "0", away: present(row.intAway) ? String(row.intAway) : "0" }]
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

export function normalizeLineups(rows: RawLineup[] | null | undefined): MatchDetail["lineups"] {
  const side = (home: string) => (rows ?? [])
    .filter((row) => row.strHome === home && row.strPlayer)
    .map((row, index) => ({ id: row.idLineup ?? row.idPlayer ?? String(index), name: row.strPlayer as string, number: whole(row.intSquadNumber), group: positionGroup(row.strPosition), substitute: row.strSubstitute === "Yes" }))
    .sort((a, b) => Number(a.substitute) - Number(b.substitute) || GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
  return { home: side("Yes"), away: side("No") }
}
