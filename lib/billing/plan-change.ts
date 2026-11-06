import type Stripe from "stripe"
import { ApiError } from "@/lib/api-auth"
import type { EntitlementRecord } from "./entitlements"
import type { BillingInterval, PaidPlanId } from "./plans"

const PLAN_RANK: Record<PaidPlanId, number> = { basic: 1, plus: 2, premium: 3 }

interface PlanChoice {
  plan: PaidPlanId
  interval: BillingInterval
}

/**
 * A higher plan is paid before it is granted. Stripe also invoices a new billing
 * interval at once, so that has to be paid before the change stands too. A lower plan
 * on the same interval owes nothing: Stripe credits the next invoice.
 */
export function planChangeChargesNow(from: PlanChoice, to: PlanChoice): boolean {
  return PLAN_RANK[to.plan] > PLAN_RANK[from.plan] || to.interval !== from.interval
}

function paymentFailed(error: unknown): boolean {
  const { statusCode, type } = error as { statusCode?: number; type?: string }
  return statusCode === 402 || type === "StripeCardError"
}

/** With error_if_incomplete Stripe leaves the subscription untouched when the charge fails. */
export async function applyPlanChange(
  stripe: Pick<Stripe, "subscriptions">,
  record: Pick<EntitlementRecord, "plan" | "interval" | "stripeSubscriptionId">,
  target: PlanChoice,
  price: string,
): Promise<{ chargedNow: boolean }> {
  const chargedNow = planChangeChargesNow(record, target)
  const subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId)
  try {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: subscription.items.data[0].id, price }],
      cancel_at_period_end: false,
      metadata: { ...subscription.metadata, ...target },
      ...(chargedNow
        ? { proration_behavior: "always_invoice" as const, payment_behavior: "error_if_incomplete" as const }
        : { proration_behavior: "create_prorations" as const }),
    })
  } catch (error) {
    if (paymentFailed(error)) throw new ApiError(402, "payment_failed", "Your payment did not go through, so your plan has not changed")
    throw error
  }
  return { chargedNow }
}
