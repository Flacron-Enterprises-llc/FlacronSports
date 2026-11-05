import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireVerifiedUser } from "@/lib/api-auth"
import { computeAccess } from "@/lib/billing/entitlements"
import { getEntitlementRecord, getStoredCustomerId, storeCustomerId } from "@/lib/billing/firestore-store"
import { APP_ID, isBillingInterval, isPaidPlan, priceIdFor } from "@/lib/billing/plans"
import { getStripe } from "@/lib/billing/stripe-client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    const { plan, interval } = await request.json().catch(() => ({}))

    if (!isPaidPlan(plan) || !isBillingInterval(interval)) {
      throw new ApiError(400, "invalid_plan", "Choose a valid plan and billing interval")
    }
    const price = priceIdFor(plan, interval)
    if (!price) throw new ApiError(503, "plan_unavailable", "This plan is not available yet")

    const access = computeAccess(await getEntitlementRecord(user.uid))
    if (access.plan !== "free") {
      throw new ApiError(409, "already_subscribed", "You already have a subscription. Manage it from Billing.")
    }

    const stripe = getStripe()
    let customer = await getStoredCustomerId(user.uid)
    if (!customer) {
      const created = await stripe.customers.create(
        { email: user.email ?? undefined, metadata: { app_id: APP_ID, firebase_uid: user.uid } },
        { idempotencyKey: `${APP_ID}-customer-${user.uid}` },
      )
      customer = created.id
      await storeCustomerId(user.uid, customer)
    }

    const metadata = { app_id: APP_ID, firebase_uid: user.uid, plan, interval }
    const origin = process.env.APP_BASE_URL || new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      adaptive_pricing: { enabled: false },
      customer,
      client_reference_id: user.uid,
      line_items: [{ price, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/app/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/billing?checkout=canceled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
