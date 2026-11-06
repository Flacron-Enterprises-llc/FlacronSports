import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { assertId, OPAQUE_REF, ROOM_ID } from "@/lib/community/content"
import { removeGroupMember, resolveGroupMemberRef } from "@/lib/community/groups"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`groups:${user.uid}`, 10, 60_000)
    const { id, uid: target } = await params
    const groupId = assertId(id, ROOM_ID)
    const db = firestoreDocDb()
    const targetUid = target === "me" ? user.uid : await resolveGroupMemberRef(db, groupId, assertId(target, OPAQUE_REF))
    await removeGroupMember(db, { groupId, actorUid: user.uid, targetUid })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
