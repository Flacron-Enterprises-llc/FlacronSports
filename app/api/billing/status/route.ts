import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { liveAccessAddons } from "@/lib/billing/addons"
import { getEffectiveAccess, getSubscriptionAccess, getUserPurchases } from "@/lib/billing/firestore-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    // Drives the plan and cancel controls, which only apply to a real subscription.
    const access = await getSubscriptionAccess(user.uid)
    const purchases = await getUserPurchases(user.uid).catch(() => [])
    // `plan` is the subscription; `effectivePlan` also counts a live day pass, and decides access.
    const { plan: effectivePlan } = await getEffectiveAccess(user.uid)
    return NextResponse.json({ ...access, effectivePlan, isPaid: access.plan !== "none", addons: liveAccessAddons(purchases, Date.now()) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
