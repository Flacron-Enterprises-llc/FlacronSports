import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireVerifiedUser } from "@/lib/api-auth"
import { audit } from "@/lib/audit"
import { getEntitlementRecord } from "@/lib/billing/firestore-store"
import { isBillingInterval, isPaidPlan, priceIdFor } from "@/lib/billing/plans"
import { getStripe } from "@/lib/billing/stripe-client"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    rateLimit(`change-plan:${user.uid}`, 5, 60_000)
    const { plan, interval } = await request.json().catch(() => ({}))
    if (!isPaidPlan(plan) || !isBillingInterval(interval)) throw new ApiError(400, "invalid_plan", "Choose a valid plan")

    const price = priceIdFor(plan, interval)
    if (!price) throw new ApiError(503, "plan_unavailable", "This plan is not available yet")

    const record = await getEntitlementRecord(user.uid)
    if (!record || !["active", "trialing"].includes(record.status)) {
      throw new ApiError(404, "no_subscription", "No active subscription found")
    }
    if (record.plan === plan && record.interval === interval) throw new ApiError(409, "same_plan", "You are already on this plan")

    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId)
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: subscription.items.data[0].id, price }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: { ...subscription.metadata, plan, interval },
    })
    await audit("billing.plan_changed", user.uid, { plan, interval })

    // The webhook writes the entitlement; this response does not grant anything.
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
