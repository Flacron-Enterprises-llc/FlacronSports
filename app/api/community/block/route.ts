import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { blockAuthor, listBlocked, unblockAuthor } from "@/lib/community/chat"
import { assertId, OPAQUE_REF } from "@/lib/community/content"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ scope: z.enum(["match", "room"]), scopeId: z.string().max(64), messageId: z.string().max(64) })

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`block-list:${user.uid}`, 60, 60_000)
    return NextResponse.json({ blocked: await listBlocked(firestoreDocDb(), user.uid) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`block:${user.uid}`, 20, 60_000)
    const { ref } = await request.json().catch(() => ({}))
    await unblockAuthor(firestoreDocDb(), { uid: user.uid, ref: assertId(ref, OPAQUE_REF) })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`block:${user.uid}`, 20, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid request")
    await blockAuthor(firestoreDocDb(), { ...parsed.data, uid: user.uid })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
