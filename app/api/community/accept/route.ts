import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { acceptGuidelines } from "@/lib/community/gate"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriberOrPurchase } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ ageConfirmed: z.literal(true), guidelinesAccepted: z.literal(true) })

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriberOrPurchase(user.uid, "room")
    rateLimit(`community-accept:${user.uid}`, 10, 60_000)
    if (!schema.safeParse(await request.json().catch(() => null)).success) {
      throw new ApiError(400, "invalid_request", "Confirm your age and accept the Community Guidelines")
    }
    await acceptGuidelines(firestoreDocDb(), user.uid, new Date())
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
