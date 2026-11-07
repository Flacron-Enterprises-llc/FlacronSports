// The platform's own administrators use every feature without a plan. Their access comes from
// the "admin" role on their sign-in account, set only by an operator, never from billing, so
// nothing here touches Stripe or the stored subscription.

import { getAdminAuth } from "@/lib/firebase-admin"
import type { EffectiveAccess } from "./entitlements"

const CACHE_MS = 5 * 60_000
const known = new Map<string, { admin: boolean; at: number }>()

/** A failed lookup is not an admin: access resolves downward, never upward. */
export async function isPlatformAdmin(uid: string, now: number = Date.now()): Promise<boolean> {
  const cached = known.get(uid)
  if (cached && now - cached.at < CACHE_MS) return cached.admin
  let admin = false
  try {
    admin = (await getAdminAuth()?.getUser(uid))?.customClaims?.role === "admin"
  } catch {
    admin = false
  }
  known.set(uid, { admin, at: now })
  return admin
}

export const ADMIN_ACCESS: EffectiveAccess = { plan: "premium", state: "active", interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }

export function clearAdminCache(): void {
  known.clear()
}
