import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { assertId, ROOM_ID } from "@/lib/community/content"
import { revokeGroupInvite } from "@/lib/community/groups"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

async function revoke(request: Request, { params }: Context, replace: boolean) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`groups:${user.uid}`, 10, 60_000)
    const groupId = assertId((await params).id, ROOM_ID)
    return NextResponse.json(await revokeGroupInvite(firestoreDocDb(), { groupId, uid: user.uid, replace }))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

/** Replaces the invitation; the previous link stops working. */
export function POST(request: Request, context: Context) {
  return revoke(request, context, true)
}

export function DELETE(request: Request, context: Context) {
  return revoke(request, context, false)
}
