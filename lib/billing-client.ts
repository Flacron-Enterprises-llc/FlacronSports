import { authFetch } from "@/lib/auth-fetch"
import type { Dictionary } from "@/lib/i18n"
import { isBillingInterval, isPaidPlan, type BillingInterval, type PaidPlanId } from "@/lib/billing/plans"
import { cleanHandoff, getOfferHandoff, parseOfferHandoff, trackGrowthEvent, type OfferHandoff } from "@/lib/growth-engine"

const KEY = "fs-pending-plan"

export interface PendingPlan {
  plan: PaidPlanId
  interval: BillingInterval
}

/** The Growth Engine offer in hand, from this tab or from the link that opened it. */
function currentOffer(): OfferHandoff {
  return { ...getOfferHandoff(), ...parseOfferHandoff(typeof window === "undefined" ? "" : window.location.search) }
}

// localStorage, not sessionStorage: the verification link often opens in a new tab.
// The Growth Engine offer travels with the chosen plan for the same reason.
export function rememberPlan(pending: PendingPlan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ plan: pending.plan, interval: pending.interval, offer: currentOffer() }))
  } catch {
    /* storage unavailable: the user can pick the plan again */
  }
}

export function pendingPlan(): PendingPlan | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null")
    return value && isPaidPlan(value.plan) && isBillingInterval(value.interval) ? value : null
  } catch {
    return null
  }
}

export function clearPendingPlan(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

function pendingOffer(): OfferHandoff {
  try {
    return cleanHandoff(JSON.parse(localStorage.getItem(KEY) ?? "null")?.offer)
  } catch {
    return {}
  }
}

export async function startCheckout({ plan, interval }: PendingPlan): Promise<void> {
  const { promoCode, fcgeRef } = { ...pendingOffer(), ...currentOffer() }
  const response = await authFetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan, interval, promoCode, fcgeRef }) })
  const data = await response.json()
  if (!response.ok || !data.url) throw Object.assign(new Error(data.error || "Checkout could not be started"), { code: data.code as string | undefined })
  clearPendingPlan()
  trackGrowthEvent("checkout_started", { plan, interval, ...(promoCode ? { promo_code: promoCode } : {}) })
  window.location.assign(data.url)
}

/** Server messages are English only, so people see the translated text for the code. */
export function billingMessage(code: string | null | undefined, t: Dictionary): string {
  const messages = t.ui.billingErrors as Record<string, string>
  return (code && messages[code]) || t.account.failed
}
