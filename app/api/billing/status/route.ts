import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getSubscriptionAccess } from "@/lib/billing/firestore-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    // Drives the plan and cancel controls, which only apply to a real subscription.
    const access = await getSubscriptionAccess(user.uid)
    return NextResponse.json({ ...access, isPaid: access.plan !== "free" })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
