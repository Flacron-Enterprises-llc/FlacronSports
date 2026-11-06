import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { assertId, OPAQUE_REF, ROOM_ID } from "@/lib/community/content"
import { removeMember, resolveMemberRef } from "@/lib/community/rooms"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`rooms:${user.uid}`, 10, 60_000)
    const { id, uid: target } = await params
    const roomId = assertId(id, ROOM_ID)
    const db = firestoreDocDb()
    const targetUid = target === "me" ? user.uid : await resolveMemberRef(db, roomId, assertId(target, OPAQUE_REF))
    await removeMember(db, { roomId, actorUid: user.uid, targetUid })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
