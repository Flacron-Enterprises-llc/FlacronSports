import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { reportMessage } from "@/lib/community/chat"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriberOrPurchase } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  scope: z.enum(["match", "room"]),
  scopeId: z.string().max(64),
  messageId: z.string().max(64),
  reason: z.enum(["spam", "abuse", "illegal_stream", "other"]),
})

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriberOrPurchase(user.uid, "room")
    rateLimit(`report:${user.uid}`, 10, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid report")
    const result = await reportMessage(firestoreDocDb(), { ...parsed.data, reporterUid: user.uid }, new Date())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
