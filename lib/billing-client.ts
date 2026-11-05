import { authFetch } from "@/lib/auth-fetch"
import { isBillingInterval, isPaidPlan, type BillingInterval, type PaidPlanId } from "@/lib/billing/plans"

const KEY = "fs-pending-plan"

export interface PendingPlan {
  plan: PaidPlanId
  interval: BillingInterval
}

// localStorage, not sessionStorage: the verification link often opens in a new tab.
export function rememberPlan(pending: PendingPlan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
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

export async function startCheckout({ plan, interval }: PendingPlan): Promise<void> {
  const response = await authFetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan, interval }) })
  const data = await response.json()
  if (!response.ok || !data.url) throw new Error(data.error || "Checkout could not be started")
  clearPendingPlan()
  window.location.assign(data.url)
}
