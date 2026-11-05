import Stripe from "stripe"

const LIVE_KEY = /^(sk|rk)_live_/

/** Throws on a live key. Production stays on Stripe test mode until the owner opts in. */
export function assertAllowedStripeKey(
  key: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured")
  if (LIVE_KEY.test(key) && env.STRIPE_LIVE_MODE_APPROVED !== "true") {
    throw new Error("Refusing to start with a live Stripe key: live billing has not been approved")
  }
  return key
}

export function liveModeApproved(env: Record<string, string | undefined> = process.env): boolean {
  return env.STRIPE_LIVE_MODE_APPROVED === "true"
}

let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(assertAllowedStripeKey(process.env.STRIPE_SECRET_KEY), {
      apiVersion: "2025-05-28.basil",
      appInfo: { name: "flacron-sport" },
    })
  }
  return client
}
