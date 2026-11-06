import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { assertId, ROOM_ID } from "@/lib/community/content"
import { closeGroup, getGroup } from "@/lib/community/groups"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`groups-read:${user.uid}`, 60, 60_000)
    const groupId = assertId((await params).id, ROOM_ID)
    return NextResponse.json(await getGroup(firestoreDocDb(), groupId, user.uid))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`groups:${user.uid}`, 10, 60_000)
    const groupId = assertId((await params).id, ROOM_ID)
    await closeGroup(firestoreDocDb(), { groupId, uid: user.uid })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
