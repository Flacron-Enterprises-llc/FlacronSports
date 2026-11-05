// Single source of truth for FlacronSport plans. Pricing pages, checkout and
// server-side entitlement checks all read from here so they cannot drift.

export const APP_ID = "flacron-sport"

export type PlanId = "free" | "plus" | "premium"
export type PaidPlanId = Exclude<PlanId, "free">
export type BillingInterval = "monthly" | "annual"

export interface PlanDefinition {
  id: PlanId
  name: string
  monthlyPriceUsd: number
  annualPriceUsd: number
  favoritesLimit: number | null // null = unlimited
  assistantRequestsPerMonth: number
  displayAds: boolean
  privateRooms: { active: number; participantsPerRoom: number } | null
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    favoritesLimit: 5,
    assistantRequestsPerMonth: 5,
    displayAds: true,
    privateRooms: null,
  },
  plus: {
    id: "plus",
    name: "Plus",
    monthlyPriceUsd: 6.99,
    annualPriceUsd: 59.99,
    favoritesLimit: null,
    assistantRequestsPerMonth: 100,
    displayAds: false,
    privateRooms: { active: 3, participantsPerRoom: 20 },
  },
  premium: {
    id: "premium",
    name: "Premium",
    monthlyPriceUsd: 12.99,
    annualPriceUsd: 119.99,
    favoritesLimit: null,
    assistantRequestsPerMonth: 300,
    displayAds: false,
    privateRooms: { active: 10, participantsPerRoom: 50 },
  },
}

const PRICE_ENV: Record<PaidPlanId, Record<BillingInterval, string>> = {
  plus: { monthly: "STRIPE_PRICE_PLUS_MONTHLY", annual: "STRIPE_PRICE_PLUS_ANNUAL" },
  premium: { monthly: "STRIPE_PRICE_PREMIUM_MONTHLY", annual: "STRIPE_PRICE_PREMIUM_ANNUAL" },
}

export function isPaidPlan(value: unknown): value is PaidPlanId {
  return value === "plus" || value === "premium"
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual"
}

export function priceIdFor(
  plan: PaidPlanId,
  interval: BillingInterval,
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env[PRICE_ENV[plan][interval]] || null
}

/** Reverse lookup. A price outside this app's catalog returns null and grants nothing. */
export function planForPriceId(
  priceId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): { plan: PaidPlanId; interval: BillingInterval } | null {
  if (!priceId) return null
  for (const plan of ["plus", "premium"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      if (env[PRICE_ENV[plan][interval]] === priceId) return { plan, interval }
    }
  }
  return null
}
