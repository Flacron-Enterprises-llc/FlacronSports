import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { blockAuthor } from "@/lib/community/chat"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ scope: z.enum(["match", "room"]), scopeId: z.string().max(64), messageId: z.string().max(64) })

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`block:${user.uid}`, 20, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid request")
    await blockAuthor(firestoreDocDb(), { ...parsed.data, uid: user.uid })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
