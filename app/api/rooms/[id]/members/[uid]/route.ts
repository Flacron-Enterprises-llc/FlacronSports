import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { assertId, ROOM_ID } from "@/lib/community/content"
import { removeMember } from "@/lib/community/rooms"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`rooms:${user.uid}`, 10, 60_000)
    const { id, uid } = await params
    await removeMember(firestoreDocDb(), { roomId: assertId(id, ROOM_ID), actorUid: user.uid, targetUid: assertId(uid, /^[\w-]{1,128}$/) })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
