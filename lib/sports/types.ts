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
  /** Enabled only after coverage validation. Football and basketball come first. */
  enabled: boolean
  providerKey?: string
}

export const SPORTS: SportDefinition[] = [
  { id: "football", name: { en: "Football", fr: "Football" }, enabled: true, providerKey: "Soccer" },
  { id: "basketball", name: { en: "Basketball", fr: "Basketball" }, enabled: true, providerKey: "Basketball" },
  { id: "american-football", name: { en: "American football", fr: "Football américain" }, enabled: false },
  { id: "baseball", name: { en: "Baseball", fr: "Baseball" }, enabled: false },
  { id: "ice-hockey", name: { en: "Ice hockey", fr: "Hockey sur glace" }, enabled: false },
  { id: "tennis", name: { en: "Tennis", fr: "Tennis" }, enabled: false },
  { id: "cricket", name: { en: "Cricket", fr: "Cricket" }, enabled: false },
  { id: "rugby", name: { en: "Rugby", fr: "Rugby" }, enabled: false },
  { id: "volleyball", name: { en: "Volleyball", fr: "Volley-ball" }, enabled: false },
  { id: "combat-sports", name: { en: "Combat sports", fr: "Sports de combat" }, enabled: false },
  { id: "motorsport", name: { en: "Motorsport", fr: "Sport automobile" }, enabled: false },
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

export type EventScore =
  | { kind: "none" }
  | { kind: "team"; home: number; away: number }

export interface SportEvent {
  id: string
  sportId: SportId
  eventType: "match"
  participantType: ParticipantType
  participants: Participant[]
  competition: { id: string | null; name: string; country: string | null }
  scheduledStartUTC: string | null
  status: EventStatus
  /** Raw provider status, kept so unmapped values stay visible to operators. */
  providerStatus: string | null
  score: EventScore
  venue: string | null
  provider: { name: string; eventId: string }
  sourceUpdatedAt: string | null
  coverageFlags: { liveScores: boolean; statistics: boolean; video: boolean }
}

export type FeedState = "ok" | "stale" | "unavailable"

export interface EventFeed {
  state: FeedState
  events: SportEvent[]
  source: string
  fetchedAt: string
  /** Set while the feed is a limited tier that must not be presented as full coverage. */
  limited: boolean
}
