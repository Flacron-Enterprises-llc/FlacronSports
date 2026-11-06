import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { referralSummary } from "@/lib/community/referrals"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`referrals:${user.uid}`, 30, 60_000)
    if (!user.email) throw new ApiError(403, "email_not_verified", "Verify your email address to continue")
    return NextResponse.json(await referralSummary(firestoreDocDb(), { uid: user.uid, email: user.email }, new Date()))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
