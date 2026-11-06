import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { reactToMessage } from "@/lib/community/engagement"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriberOrPurchase } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ scope: z.enum(["match", "room"]), scopeId: z.string().max(64), messageId: z.string().max(64), reaction: z.string().max(16) })

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriberOrPurchase(user.uid, "room")
    rateLimit(`react:${user.uid}`, 40, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid request")
    return NextResponse.json(await reactToMessage(firestoreDocDb(), { ...parsed.data, uid: user.uid }, new Date()))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
