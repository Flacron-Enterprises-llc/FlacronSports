// Shared event schema (spec section 11). Participants are a list rather than
// home/away so individual athletes and motorsport entrants are not forced into
// fake teams, and score is a tagged union so sets or innings are never flattened.

export type SportId =
  | "football"
  | "basketball"
  | "american-football"
  | "baseball"
  | "ice-hockey"
  | "tennis"
  | "cricket"
  | "rugby"
  | "volleyball"
  | "combat-sports"
  | "motorsport"

export interface SportDefinition {
  id: SportId
  name: { en: string; fr: string }
  /** Enabled only after the provider returned real events with correct participants. */
  enabled: boolean
  providerKey?: string
}

export const SPORTS: SportDefinition[] = [
  { id: "football", name: { en: "Football", fr: "Football" }, enabled: true, providerKey: "Soccer" },
  { id: "basketball", name: { en: "Basketball", fr: "Basketball" }, enabled: true, providerKey: "Basketball" },
  { id: "american-football", name: { en: "American football", fr: "Football américain" }, enabled: true, providerKey: "American Football" },
  { id: "baseball", name: { en: "Baseball", fr: "Baseball" }, enabled: true, providerKey: "Baseball" },
  { id: "ice-hockey", name: { en: "Ice hockey", fr: "Hockey sur glace" }, enabled: true, providerKey: "Ice Hockey" },
  { id: "tennis", name: { en: "Tennis", fr: "Tennis" }, enabled: true, providerKey: "Tennis" },
  { id: "cricket", name: { en: "Cricket", fr: "Cricket" }, enabled: true, providerKey: "Cricket" },
  { id: "rugby", name: { en: "Rugby", fr: "Rugby" }, enabled: true, providerKey: "Rugby" },
  { id: "volleyball", name: { en: "Volleyball", fr: "Volley-ball" }, enabled: true, providerKey: "Volleyball" },
  { id: "combat-sports", name: { en: "Combat sports", fr: "Sports de combat" }, enabled: true, providerKey: "Fighting" },
  { id: "motorsport", name: { en: "Motorsport", fr: "Sport automobile" }, enabled: true, providerKey: "Motorsport" },
]

export type EventStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "canceled"
  | "interrupted"
  | "abandoned"
  | "unknown"

export type ParticipantType = "team" | "individual" | "pair" | "entrant"

export interface Participant {
  id: string | null
  name: string
  role: "home" | "away" | "competitor"
  badgeUrl: string | null
}

export interface SetLine {
  name: string
  games: number[]
}

export interface Innings {
  runs: number
  wickets: number | null
  overs: string | null
}

export type CombatMethod =
  | "unanimous-decision"
  | "split-decision"
  | "majority-decision"
  | "decision"
  | "ko"
  | "tko"
  | "submission"
  | "disqualification"

export interface ClassificationEntry {
  position: number
  name: string
  team: string | null
  time: string | null
  laps?: number | null
  grid?: number | null
}

/** One period of a game. A side the source left blank stays null, never zero. */
export interface ScoreSegment {
  kind: "quarter" | "half" | "inning" | "set" | "overtime"
  number: number
  home: number | null
  away: number | null
}

/** Period scores read from the source's result text. Other sports get no statistics feed. */
export interface ScoreBreakdown {
  segments: ScoreSegment[]
  /** Baseball box score totals. */
  hits?: { home: number; away: number }
  errors?: { home: number; away: number }
}

/** How a finished game ended, when it was not in regular time. */
export type EventConclusion = "extra-time" | "overtime" | "penalties" | "shootout" | "awarded" | "walkover"

export type EventScore =
  | { kind: "none" }
  | { kind: "team"; home: number; away: number }
  | { kind: "sets"; lines: SetLine[]; winner: string | null; retired: string | null }
  | { kind: "innings"; home: Innings | null; away: Innings | null; winner: string | null; margin: { value: number; unit: "runs" | "wickets" } | null }
  | { kind: "combat"; winner: string; method: CombatMethod | null; round: number | null; time: string | null }
  | { kind: "classification"; entries: ClassificationEntry[] }

export interface SportEvent {
  id: string
  sportId: SportId
  eventType: "match" | "bout" | "fight-card" | "session"
  participantType: ParticipantType
  /** Empty when the source names nobody, for example a practice session. */
  participants: Participant[]
  /** Tournament, fight card or session name, for events not named after two sides. */
  eventName?: string | null
  competition: { id: string | null; name: string; country: string | null }
  scheduledStartUTC: string | null
  /** The source gave a date with a midnight placeholder, so no start time is known. */
  dateOnly?: boolean
  status: EventStatus
  /** Minutes played or the period clock, while a game is live and the feed states it. */
  clock?: string | null
  conclusion?: EventConclusion
  /** Only when the source states it. */
  shootout?: { home: number; away: number }
  breakdown?: ScoreBreakdown
  /** Raw provider status, kept so unmapped values stay visible to operators. */
  providerStatus: string | null
  score: EventScore
  venue: string | null
  /** A video link listed by the feed. Listing it is not permission: see lib/video/catalog. */
  videoUrl?: string | null
  thumbnailUrl?: string | null
  provider: { name: string; eventId: string }
  sourceUpdatedAt: string | null
  coverageFlags: { liveScores: boolean; statistics: boolean; video: boolean }
}

/** "withheld": the backend refused this viewer, so nothing is shown and nothing is wrong. */
export type FeedState = "ok" | "stale" | "unavailable" | "withheld"

export interface EventFeed {
  state: FeedState
  events: SportEvent[]
  source: string
  fetchedAt: string
  /** Set while the feed is a limited tier that must not be presented as full coverage. */
  limited: boolean
}
