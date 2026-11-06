import { purchaseLive, type BillingPurchase } from "./addons"
import type { BillingInterval, PaidPlanId, PlanId } from "./plans"

/** Days of access kept after a failed renewal while Stripe retries the payment. */
export const PAST_DUE_GRACE_DAYS = 3
/** Tolerance for a delayed renewal webhook on an otherwise active subscription. */
export const RENEWAL_LEEWAY_DAYS = 3

const DAY_SECONDS = 86_400

export type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"

/** Stored at billing_entitlements/{uid}. Written only by the verified webhook. */
export interface EntitlementRecord {
  application_id: string
  uid: string
  plan: PaidPlanId
  interval: BillingInterval
  status: StripeSubscriptionStatus
  stripeCustomerId: string
  stripeSubscriptionId: string
  currentPeriodEnd: number // unix seconds
  cancelAtPeriodEnd: boolean
  lastEventCreated: number // unix seconds
}

export type AccessState = "none" | "active" | "canceling" | "past_due" | "expired"

export interface EffectiveAccess {
  plan: PlanId
  state: AccessState
  interval: BillingInterval | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
  dayPassExpiresAtUTC?: string
}

const FREE: EffectiveAccess = {
  plan: "none",
  state: "none",
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
}

/** Derives access at read time, so a missed webhook cannot extend paid access indefinitely. */
export function computeAccess(
  record: EntitlementRecord | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): EffectiveAccess {
  if (!record) return FREE

  const paid: EffectiveAccess = {
    plan: record.plan,
    state: "active",
    interval: record.interval,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
  }
  const expired: EffectiveAccess = { ...FREE, state: "expired" }

  switch (record.status) {
    case "active":
    case "trialing": {
      if (record.cancelAtPeriodEnd) {
        return nowSeconds < record.currentPeriodEnd ? { ...paid, state: "canceling" } : expired
      }
      const cutoff = record.currentPeriodEnd + RENEWAL_LEEWAY_DAYS * DAY_SECONDS
      return nowSeconds < cutoff ? paid : expired
    }
    case "past_due": {
      const cutoff = record.currentPeriodEnd + PAST_DUE_GRACE_DAYS * DAY_SECONDS
      return nowSeconds < cutoff ? { ...paid, state: "past_due" } : expired
    }
    default:
      return expired
  }
}

/**
 * Premium benefits for a live day pass. Subscription fields stay empty because a
 * pass has no renewal, cancellation or billing schedule of its own.
 */
export function withDayPass(
  access: EffectiveAccess,
  pass: Pick<BillingPurchase, "sku" | "status" | "expiresAtUTC"> | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): EffectiveAccess {
  if (access.plan === "premium" || pass?.sku !== "day_pass" || !purchaseLive(pass, nowSeconds * 1000)) return access
  return { ...FREE, plan: "premium", state: "active", dayPassExpiresAtUTC: pass.expiresAtUTC }
}
