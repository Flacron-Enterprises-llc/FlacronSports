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
  declared?: boolean
  followOn?: boolean
}

export type CricketFormat = "test" | "first-class" | "odi" | "t20" | "hundred"
export type CricketOutcome = "won" | "drawn" | "tied" | "no-result"
export type CricketStage = "final" | "semi-final" | "playoff" | "qualifier" | "eliminator"

export interface CricketDetails {
  kind: "cricket"
  format: CricketFormat | null
  /** What the format schedules. The source never states which day a match has reached. */
  scheduledDays: number | null
  /** Counted from the start date on the page's own day, for a match still inside its scheduled days. */
  matchDay?: number
  stage: CricketStage | null
  /** "3rd Test", as the source numbers it. */
  matchLabel: string | null
  round: number | null
  season: string | null
  group: string | null
  /** "Phase 4 (Guyana and Barbados)", a stretch of a league played in one place. */
  phase: string | null
  umpires: string | null
  dayNight: boolean
  city: string | null
  country: string | null
  women: boolean
  toss: { side: string; choice: "bat" | "field" } | null
  spectators: number | null
  /** The source's own line on the state of play, in English: "Day 3: Stumps - West Indies trail by 23 runs". May state the result. */
  statusNote?: string | null
}

export interface TennisRound {
  key: "final" | "semi-final" | "quarter-final" | "round-robin" | "round"
  number?: number
}

/** One match inside a team tie. Games read winner first. */
export interface TennisRubber {
  winner: string
  loser: string
  games: [number, number][]
  /** The set loser's tiebreak points, where a set went to one. */
  tiebreaks: (number | null)[]
}

export interface TennisDetails {
  kind: "tennis"
  format: "singles" | "doubles" | "team-tie"
  tournament: string | null
  city: string | null
  country: string | null
  round: TennisRound | null
  gender: "men" | "women" | "mixed" | null
  /** World rankings at the time of the draw, in participant order. */
  ranks: (number | null)[]
  rubbers: TennisRubber[]
  group: string | null
  season: string | null
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

export type CombatDiscipline = "boxing" | "mma" | "kickboxing" | "muay-thai" | "bare-knuckle"

/** Names read alphabetically, because the source lists the winner first. */
export interface CombatBout {
  names: [string, string]
  winner: string | null
  method: CombatMethod | null
  round: number | null
  time: string | null
  weightClass: string | null
  scheduledRounds: number | null
  section: "main" | "preliminary" | null
  /** The judges' scores, as the source writes them. */
  scorecards: string | null
  /** A bout that ended with no winner. */
  outcome?: "draw" | "no-contest" | null
  /** The belt at stake as the source names it. */
  title?: string | null
  /** Also set when the source only marks a defending champion. */
  titleFight?: boolean
  /** The source's own note on the bout, such as a missed weight. */
  note?: string | null
}

export interface CombatDetails {
  kind: "combat"
  discipline: CombatDiscipline | null
  card: string | null
  bouts: CombatBout[]
  weightClass: string | null
  scheduledRounds: number | null
  title: string | null
  city: string | null
  country: string | null
  season: string | null
  spectators: number | null
}

export interface ClassificationEntry {
  position: number
  name: string
  team: string | null
  time: string | null
  laps?: number | null
  grid?: number | null
  /** Started from the pit lane, which the source marks in place of a grid slot. */
  pitLane?: boolean
  /** Car or rider number. */
  number?: number
  points?: number
  /** The entrant's own record, when the source links one. */
  playerId?: string
  /** The car's class in an overall order that mixes classes, such as IMSA's GTP and GTD. */
  category?: string
}

/** An entrant with no classified place. */
export interface ClassifiedOut {
  name: string
  team: string | null
  /** The source's own code: RET, DNF, DNS, DQ, DSQ, NC. */
  status: string | null
  /** A reason or a distance, as the source words it. */
  note: string | null
  laps?: number
}

export interface StandingEntry {
  position: number
  name: string
  team?: string
  points: number
}

export type MotorsportSession = "practice" | "testing" | "sprint-qualifying" | "qualifying" | "sprint" | "race" | "stage"

export interface MotorsportDetails {
  kind: "motorsport"
  session: MotorsportSession
  sessionNumber: number | null
  weekend: string | null
  /** Category within a multi-class session. */
  className: string | null
  round: number | null
  circuit: string | null
  city: string | null
  country: string | null
  season: string | null
  scheduledLaps: number | null
}

/** One period of a game. A side the source left blank stays null, never zero. */
export interface ScoreSegment {
  kind: "quarter" | "half" | "period" | "inning" | "extras" | "set" | "overtime" | "shootout" | "extra"
  number: number
  home: number | null
  away: number | null
}

/** Period scores read from the source's result text. Empty segments mean only the totals below are known. */
export interface ScoreBreakdown {
  segments: ScoreSegment[]
  /** Baseball box score totals. */
  hits?: { home: number; away: number }
  errors?: { home: number; away: number }
  /** Rugby, where the feed states them. */
  tries?: { home: number; away: number }
}

/** How a finished game ended, when it was not in regular time. */
export type EventConclusion = "extra-time" | "overtime" | "penalties" | "shootout" | "awarded" | "walkover"

export interface FootballDetails {
  kind: "football"
  /** The match week. Null for a stage, or where the source gives no usable number. */
  round: number | null
  stage: "quarter" | "semi" | "final" | null
  group: string | null
  season: string | null
  city: string | null
  country: string | null
  /** The source's own words on the game, in English only. May state the result. */
  summary: string | null
}

export interface BasketballDetails {
  kind: "basketball"
  /** The numbered round, where a league has them. The NBA and WNBA number weeks and do not. */
  round: number | null
  stage: "preseason" | "play-in" | "first-round" | "quarter" | "semi" | "final" | null
  group: string | null
  season: string | null
  city: string | null
  country: string | null
  spectators: number | null
}

export interface AmericanFootballDetails {
  kind: "american-football"
  /** The week of the regular season. Null for preseason and playoff games. */
  week: number | null
  stage: "preseason" | "wild-card" | "divisional" | "conference-final" | "super-bowl" | "division-semi-final" | "division-final" | "grey-cup" | "postseason" | "fcs-final" | "national-final" | "quarter-final" | "semi-final" | "playoff" | "final" | null
  season: string | null
  city: string | null
  country: string | null
  spectators: number | null
}

export type RugbyStage = "preseason" | "qualifying-final" | "eliminator" | "playoff" | "quarter" | "semi" | "preliminary-final" | "third-place" | "final" | "grand-final"

export interface RugbyDetails {
  kind: "rugby"
  /** Union and league share the source's one rugby feed. Null for a competition not known to be either. */
  code: "union" | "league" | "sevens" | null
  round: number | null
  stage: RugbyStage | null
  group: string | null
  season: string | null
  city: string | null
  country: string | null
  spectators: number | null
}

export interface VolleyballDetails {
  kind: "volleyball"
  round: number | null
  stage: "quarter" | "semi" | "third-place" | "final" | null
  group: string | null
  season: string | null
  city: string | null
  country: string | null
  /** A cup tie level on sets after two legs is settled by one set to 15, filed as its own game. Its score is points. */
  goldenSet: boolean
}

export type SportDetails = CricketDetails | TennisDetails | CombatDetails | MotorsportDetails | FootballDetails | BasketballDetails | AmericanFootballDetails | VolleyballDetails | RugbyDetails

export type EventScore =
  | { kind: "none" }
  | { kind: "team"; home: number; away: number }
  | { kind: "sets"; lines: SetLine[]; winner: string | null; retired: string | null; walkover?: boolean; tiebreaks?: (number | null)[] }
  | {
      kind: "innings"
      home: Innings | null
      away: Innings | null
      winner: string | null
      margin: { value: number; unit: "runs" | "wickets" } | null
      outcome?: CricketOutcome
      /** Each innings, for formats where a side bats twice. */
      homeInnings?: Innings[]
      awayInnings?: Innings[]
      /** home and away are match totals with no innings to break them down. */
      totalsOnly?: boolean
      byInnings?: boolean
      ballsLeft?: number
      method?: "dls"
      rain?: boolean
      reducedOvers?: number
      revisedOvers?: number
      target?: number
      playerOfMatch?: string
    }
  | { kind: "combat"; winner: string; method: CombatMethod | null; round: number | null; time: string | null }
  | {
      kind: "classification"
      entries: ClassificationEntry[]
      /** The class these entries belong to, when a session classifies several. */
      className?: string
      classes?: { name: string; entries: ClassificationEntry[] }[]
      out?: ClassifiedOut[]
      pole?: string
      fastestLap?: { name: string; time: string | null } | null
      /** The championship as the source printed it after this session. */
      standings?: StandingEntry[]
    }

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
  /** Football: the two legs of a tie added up, in this game's home and away order. */
  aggregate?: { home: number; away: number }
  breakdown?: ScoreBreakdown
  /** Facts particular to the sport. What reveals a result lives in score, not here. */
  details?: SportDetails
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
  /** For one sport with nothing still to come on this day: the next dates that have games. */
  nextDates?: { date: string; games: number }[]
  /** Cricket: the same, for each format, so a format with no game today still leads somewhere. */
  nextByKind?: Record<string, { date: string; games: number }[]>
}
