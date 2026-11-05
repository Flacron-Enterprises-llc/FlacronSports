import { z } from "zod"
import { ApiError } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { PLANS } from "@/lib/billing/plans"
import { getAdminDb } from "@/lib/firebase-admin"

export const ALERT_TYPES = ["start", "final", "participants", "scoring", "interval", "highlights"] as const

export const preferencesSchema = z.object({
  locale: z.enum(["en", "fr"]),
  timeZone: z.string().max(64),
  spoilerMode: z.boolean(),
  lowData: z.boolean(),
  favorites: z.array(z.string().min(1).max(120)).max(500),
  alerts: z.object({
    muted: z.boolean(),
    types: z.array(z.enum(ALERT_TYPES)).max(ALERT_TYPES.length),
    quietStart: z.number().int().min(0).max(23).nullable(),
    quietEnd: z.number().int().min(0).max(23).nullable(),
    email: z.boolean().default(false),
  }),
  newsletter: z.object({ optedIn: z.boolean(), consentedAt: z.string().nullable() }),
  tourVersion: z.number().int().min(0),
})

export type Preferences = z.infer<typeof preferencesSchema>

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  timeZone: "UTC",
  spoilerMode: false,
  lowData: false,
  favorites: [],
  alerts: { muted: false, types: ["start", "final"], quietStart: null, quietEnd: null, email: false },
  newsletter: { optedIn: false, consentedAt: null },
  tourVersion: 0,
}

/** Free alerts cover start and final only; every other type needs a paid plan. */
export const FREE_ALERTS = ["start", "final"] as const

const db = () => {
  const instance = getAdminDb()
  if (!instance) throw new ApiError(503, "storage_unavailable", "Preferences are temporarily unavailable")
  return instance
}

export async function getPreferences(uid: string): Promise<Preferences> {
  const doc = await db().collection("user_preferences").doc(uid).get()
  return { ...DEFAULT_PREFERENCES, ...(doc.data() as Partial<Preferences> | undefined) }
}

export async function updatePreferences(uid: string, patch: unknown): Promise<Preferences> {
  const parsed = preferencesSchema.partial().safeParse(patch)
  if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid preferences")

  const current = await getPreferences(uid)
  const { plan } = await getEffectiveAccess(uid)
  const next: Preferences = { ...current, ...parsed.data }

  // Downgrades keep saved data, but nothing new can be added past the plan limit.
  const limit = PLANS[plan].favoritesLimit
  if (limit !== null && next.favorites.length > Math.max(limit, current.favorites.length)) {
    throw new ApiError(403, "favorites_limit", "The Free plan includes 5 favorites")
  }
  if (plan === "free") {
    next.alerts = { ...next.alerts, types: next.alerts.types.filter((type) => (FREE_ALERTS as readonly string[]).includes(type)) }
  }
  if (next.newsletter.optedIn && !current.newsletter.optedIn) {
    next.newsletter = { optedIn: true, consentedAt: new Date().toISOString() }
  }

  await db().collection("user_preferences").doc(uid).set({ ...next, updatedAt: new Date().toISOString() })
  return next
}
