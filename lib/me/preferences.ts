import { z } from "zod"
import { ApiError } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { hasPlusFeatures, PLANS } from "@/lib/billing/plans"
import { getAdminDb } from "@/lib/firebase-admin"
import { favoriteTotal, HOME_SECTIONS, MAX_BOARD_PINS, MAX_REMINDERS } from "./preferences-defaults"

export const ALERT_TYPES = ["start", "final", "participants", "scoring", "interval", "highlights"] as const

export const preferencesSchema = z.object({
  locale: z.enum(["en", "fr"]),
  timeZone: z.string().max(64),
  spoilerMode: z.boolean(),
  lowData: z.boolean(),
  scoresFavoritesOnly: z.boolean().default(false),
  favorites: z.array(z.string().min(1).max(120)).max(500),
  leagues: z.array(z.object({ id: z.string().min(1).max(20), name: z.string().min(1).max(120), sportId: z.string().max(40) })).max(500),
  players: z.array(z.object({ id: z.string().min(1).max(20), name: z.string().min(1).max(120), team: z.string().max(120).nullable(), sportId: z.string().max(40) })).max(500),
  reminders: z.array(z.object({ eventId: z.string().min(1).max(40), title: z.string().min(1).max(200), startUTC: z.string().max(40).nullable() })).max(MAX_REMINDERS),
  boardPins: z.array(z.string().min(1).max(40)).max(MAX_BOARD_PINS),
  homeFeed: z.object({ order: z.array(z.enum(HOME_SECTIONS)).max(HOME_SECTIONS.length), hidden: z.array(z.enum(HOME_SECTIONS)).max(HOME_SECTIONS.length) }),
  alerts: z.object({
    muted: z.boolean(),
    types: z.array(z.enum(ALERT_TYPES)).max(ALERT_TYPES.length),
    quietStart: z.number().int().min(0).max(23).nullable(),
    quietEnd: z.number().int().min(0).max(23).nullable(),
    email: z.boolean().default(false),
    dailySummary: z.boolean().optional(),
    filters: z.object({ sports: z.array(z.string().max(40)).max(20), majorOnly: z.boolean() }).optional(),
  }),
  newsletter: z.object({ optedIn: z.boolean(), consentedAt: z.string().nullable(), unsubscribedAt: z.string().optional() }),
  tourVersion: z.number().int().min(0),
})

export type Preferences = z.infer<typeof preferencesSchema>

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

/** Basic alerts cover start and final only; every other type needs Plus or Premium. */
export const BASIC_ALERTS = ["start", "final"] as const

const db = () => {
  const instance = getAdminDb()
  if (!instance) throw new ApiError(503, "storage_unavailable", "Preferences are temporarily unavailable")
  return instance
}

export async function getPreferences(uid: string): Promise<Preferences> {
  const doc = await db().collection("user_preferences").doc(uid).get()
  return { ...DEFAULT_PREFERENCES, ...(doc.data() as Partial<Preferences> | undefined) }
}

/** The client only says in or out. When that happened is the server's record. */
function nextNewsletter(current: Preferences["newsletter"], optedIn: boolean, now: string): Preferences["newsletter"] {
  if (optedIn === current.optedIn) return current
  return optedIn ? { ...current, optedIn, consentedAt: now } : { ...current, optedIn, unsubscribedAt: now }
}

export async function updatePreferences(uid: string, patch: unknown): Promise<Preferences> {
  const parsed = preferencesSchema.partial().safeParse(patch)
  if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid preferences")

  const current = await getPreferences(uid)
  const { plan } = await getEffectiveAccess(uid)
  const next: Preferences = { ...current, ...parsed.data }

  // Downgrades keep saved data, but nothing new can be added past the plan limit.
  const limit = PLANS[plan].favoritesLimit
  if (limit !== null && favoriteTotal(next) > Math.max(limit, favoriteTotal(current))) {
    throw new ApiError(403, "favorites_limit", "The Basic plan includes 5 favorites")
  }
  if (!hasPlusFeatures(plan)) {
    next.alerts = { ...next.alerts, types: next.alerts.types.filter((type) => (BASIC_ALERTS as readonly string[]).includes(type)) }
  }
  // Filters are a Premium benefit: others keep what was saved but cannot change it.
  if (plan !== "premium") {
    // Firestore refuses undefined, so an account that never set filters must not carry the key.
    const { filters: _ignored, ...alerts } = next.alerts
    next.alerts = current.alerts.filters ? { ...alerts, filters: current.alerts.filters } : alerts
  }
  next.newsletter = nextNewsletter(current.newsletter, next.newsletter.optedIn, new Date().toISOString())

  await db().collection("user_preferences").doc(uid).set({ ...next, updatedAt: new Date().toISOString() })
  return next
}
