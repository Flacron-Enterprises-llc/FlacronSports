import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getStoredCustomerId } from "@/lib/billing/firestore-store"
import { getStripe } from "@/lib/billing/stripe-client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const customer = await getStoredCustomerId(user.uid)
    if (!customer) throw new ApiError(404, "no_customer", "No billing account found")

    const origin = process.env.APP_BASE_URL || new URL(request.url).origin
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION || undefined,
      return_url: `${origin}/dashboard`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
