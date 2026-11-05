// Browser-safe copy of the shape and defaults; lib/me/preferences.ts is server only.
export type AlertType = "start" | "final" | "participants" | "scoring" | "interval" | "highlights"

export interface Preferences {
  locale: "en" | "fr"
  timeZone: string
  spoilerMode: boolean
  lowData: boolean
  favorites: string[]
  alerts: { muted: boolean; types: AlertType[]; quietStart: number | null; quietEnd: number | null }
  newsletter: { optedIn: boolean; consentedAt: string | null }
  tourVersion: number
}

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  timeZone: "UTC",
  spoilerMode: false,
  lowData: false,
  favorites: [],
  alerts: { muted: false, types: ["start", "final"], quietStart: null, quietEnd: null },
  newsletter: { optedIn: false, consentedAt: null },
  tourVersion: 0,
}
