import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEntitlementRecord } from "@/lib/billing/firestore-store"
import { getStripe } from "@/lib/billing/stripe-client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** { undo: false } cancels at period end; { undo: true } reverses a scheduled cancellation. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const { undo } = await request.json().catch(() => ({ undo: false }))

    const record = await getEntitlementRecord(user.uid)
    if (!record || !["active", "trialing", "past_due"].includes(record.status)) {
      throw new ApiError(404, "no_subscription", "No active subscription found")
    }

    // The entitlement is unchanged here: the resulting webhook updates it.
    await getStripe().subscriptions.update(record.stripeSubscriptionId, { cancel_at_period_end: !undo })

    return NextResponse.json({ success: true, cancelAtPeriodEnd: !undo, currentPeriodEnd: record.currentPeriodEnd })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
