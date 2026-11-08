// Browser-safe copy of the shape and defaults; lib/me/preferences.ts is server only.
export type AlertType = "start" | "final" | "participants" | "scoring" | "interval" | "highlights"

/** Premium. An empty sport list means every sport. */
export interface AlertFilters {
  sports: string[]
  majorOnly: boolean
}

/** The dashboard sections a member can show, hide and reorder, in their default order. */
export const HOME_SECTIONS = ["favorites", "live", "upcoming", "results", "highlights", "trending", "news"] as const
export type HomeSection = (typeof HOME_SECTIONS)[number]

export interface HomeFeed {
  order: HomeSection[]
  hidden: HomeSection[]
}

export interface FollowedLeague {
  id: string
  name: string
  sportId: string
}

export interface FollowedPlayer {
  id: string
  name: string
  team: string | null
  sportId: string
}

/** A bell on one game. The title is kept so My Teams can list it once the game leaves the feed. */
export interface EventReminder {
  eventId: string
  title: string
  startUTC: string | null
}

export const MAX_REMINDERS = 200
export const MAX_BOARD_PINS = 12

export interface Preferences {
  locale: "en" | "fr"
  timeZone: string
  spoilerMode: boolean
  lowData: boolean
  /** Scores shows followed teams, players and leagues only. */
  scoresFavoritesOnly: boolean
  /** Teams and individual athletes by name. The order is the member's priority order. */
  favorites: string[]
  leagues: FollowedLeague[]
  players: FollowedPlayer[]
  reminders: EventReminder[]
  boardPins: string[]
  homeFeed: HomeFeed
  alerts: { muted: boolean; types: AlertType[]; quietStart: number | null; quietEnd: number | null; email: boolean; dailySummary?: boolean; filters?: AlertFilters }
  newsletter: { optedIn: boolean; consentedAt: string | null; unsubscribedAt?: string }
  tourVersion: number
}

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  timeZone: "UTC",
  spoilerMode: false,
  lowData: false,
  scoresFavoritesOnly: false,
  favorites: [],
  leagues: [],
  players: [],
  reminders: [],
  boardPins: [],
  homeFeed: { order: [...HOME_SECTIONS], hidden: [] },
  alerts: { muted: false, types: ["start", "final"], quietStart: null, quietEnd: null, email: false },
  newsletter: { optedIn: false, consentedAt: null },
  tourVersion: 0,
}

/** Everything the Basic plan's favorites limit counts. */
export const favoriteTotal = (prefs: Pick<Preferences, "favorites" | "leagues" | "players">): number =>
  prefs.favorites.length + prefs.leagues.length + prefs.players.length

/** The dashboard's "Get set up" checklist: follow a team, choose alerts, decide on spoiler mode. */
export function setupChecklist(prefs: Preferences, spoilerDecided: boolean): { team: boolean; alerts: boolean; spoiler: boolean } {
  return {
    team: prefs.favorites.length > 0,
    alerts: JSON.stringify(prefs.alerts) !== JSON.stringify(DEFAULT_PREFERENCES.alerts),
    spoiler: prefs.spoilerMode || spoilerDecided,
  }
}
