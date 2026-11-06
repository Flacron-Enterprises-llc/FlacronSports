import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireSwitch, requireVerifiedUser } from "@/lib/api-auth"
import { activeDayPass, addonOnSale, isAddonSku, priceIdForAddon } from "@/lib/billing/addons"
import { getStoredCustomerId, getSubscriptionAccess, getUserPurchases, storeCustomerId } from "@/lib/billing/firestore-store"
import { APP_ID } from "@/lib/billing/plans"
import { settleOpenSessions } from "@/lib/billing/open-sessions"
import { getStripe } from "@/lib/billing/stripe-client"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    requireSwitch("FEATURE_PAYMENTS")
    rateLimit(`addon:${user.uid}`, 10, 60_000)
    const { sku } = await request.json().catch(() => ({}))

    if (!isAddonSku(sku)) throw new ApiError(400, "invalid_addon", "Choose a valid add-on")
    const price = priceIdForAddon(sku)
    if (!price || !addonOnSale(sku)) throw new ApiError(503, "addon_unavailable", "This add-on is not available yet")

    const { plan } = await getSubscriptionAccess(user.uid)
    if (sku !== "day_pass" && plan === "none") {
      throw new ApiError(402, "subscription_required", "This add-on needs a plan")
    }
    if (sku === "day_pass") {
      if (plan === "premium") {
        throw new ApiError(409, "already_premium", "Your subscription already includes Premium benefits")
      }
      if (activeDayPass(await getUserPurchases(user.uid), Date.now())) {
        throw new ApiError(409, "day_pass_active", "You already have an active day pass")
      }
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

    // One open day pass checkout at most, so a second tab cannot pay for a pass with no benefit.
    if (sku === "day_pass") {
      const dayPass = (session: { metadata: Record<string, string> | null }) => session.metadata?.sku === "day_pass"
      const reuse = await settleOpenSessions(stripe, customer, { kind: dayPass, same: dayPass })
      if (reuse) return NextResponse.json({ url: reuse })
    }

    const metadata = { app_id: APP_ID, firebase_uid: user.uid, sku }
    const origin = process.env.APP_BASE_URL || new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      adaptive_pricing: { enabled: false },
      customer,
      client_reference_id: user.uid,
      // Cards settle at checkout; delayed methods would complete the session unpaid.
      payment_method_types: ["card"],
      line_items: [{ price, quantity: 1 }],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/app/assistant?addon=success`,
      cancel_url: `${origin}/app/assistant?addon=canceled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
