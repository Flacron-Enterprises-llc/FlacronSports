import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireSwitch, requireVerifiedUser } from "@/lib/api-auth"
import { computeAccess } from "@/lib/billing/entitlements"
import { getEntitlementRecord, getStoredCustomerId, storeCustomerId } from "@/lib/billing/firestore-store"
import { APP_ID, isBillingInterval, isPaidPlan, priceIdFor } from "@/lib/billing/plans"
import { funnelMetadata, isDiscountRejection, isValidFcgeRef, normalizePromoCode, resolveCheckoutDiscount } from "@/lib/billing/growth-engine-funnel"
import { settleOpenSessions } from "@/lib/billing/open-sessions"
import { getStripe } from "@/lib/billing/stripe-client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    requireSwitch("FEATURE_PAYMENTS")
    const { plan, interval, promoCode, fcgeRef } = await request.json().catch(() => ({}))

    if (!isPaidPlan(plan) || !isBillingInterval(interval)) {
      throw new ApiError(400, "invalid_plan", "Choose a valid plan and billing interval")
    }
    const price = priceIdFor(plan, interval)
    if (!price) throw new ApiError(503, "plan_unavailable", "This plan is not available yet")

    // A past-due subscription has no access but is still live: Stripe keeps retrying it.
    const record = await getEntitlementRecord(user.uid)
    if (computeAccess(record).plan !== "none" || record?.status === "past_due") {
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

    // A Growth Engine offer (docs/growth-engine.md): an open session made without the
    // same offer is not reused, so the code and the credit are never lost.
    const ref = isValidFcgeRef(fcgeRef) ? fcgeRef : undefined
    const code = normalizePromoCode(promoCode) ?? undefined
    const reuse = await settleOpenSessions(stripe, customer, {
      kind: (session) => session.mode === "subscription",
      same: (session) =>
        session.metadata?.plan === plan &&
        session.metadata?.interval === interval &&
        session.metadata?.fcge_ref === ref &&
        session.metadata?.fcge_code === code,
    })
    if (reuse) return NextResponse.json({ url: reuse })

    const discount = await resolveCheckoutDiscount(stripe, code, APP_ID)
    const origin = process.env.APP_BASE_URL || new URL(request.url).origin
    const create = (options: typeof discount.options, appliedCode: string | null) => {
      const metadata = {
        app_id: APP_ID,
        firebase_uid: user.uid,
        plan,
        interval,
        ...funnelMetadata({ fcgeRef: ref, appliedCode }),
        // The code asked for, applied or not: only used above to match an open session.
        ...(code ? { fcge_code: code } : {}),
      }
      return stripe.checkout.sessions.create({
        mode: "subscription",
        adaptive_pricing: { enabled: false },
        customer,
        client_reference_id: user.uid,
        line_items: [{ price, quantity: 1 }],
        ...options,
        metadata,
        subscription_data: { metadata },
        success_url: `${origin}/app/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/app/billing?checkout=canceled`,
      })
    }

    let session
    try {
      session = await create(discount.options, discount.appliedCode)
    } catch (error) {
      // A code Stripe will not apply to this price falls back to the code field once.
      if (!discount.appliedCode || !isDiscountRejection(error)) throw error
      session = await create({ allow_promotion_codes: true }, null)
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
