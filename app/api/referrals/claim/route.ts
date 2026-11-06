import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { claimReferral } from "@/lib/community/referrals"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ code: z.string().max(32) })

/**
 * The one community route with no plan check: the person using an invitation has no
 * plan yet, and taking one is what the reward depends on. It only records the claim
 * and opens no member feature.
 */
export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`referral-claim:${user.uid}`, 10, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || !user.email) throw new ApiError(400, "invalid_request", "Invalid invitation")
    return NextResponse.json(await claimReferral(firestoreDocDb(), { uid: user.uid, email: user.email, code: parsed.data.code }, new Date()))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
