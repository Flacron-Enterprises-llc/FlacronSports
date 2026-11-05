import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { assertId, ROOM_ID } from "@/lib/community/content"
import { closeRoom, getRoomAsMember } from "@/lib/community/rooms"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    const roomId = assertId((await params).id, ROOM_ID)
    return NextResponse.json(await getRoomAsMember(firestoreDocDb(), roomId, user.uid))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`rooms:${user.uid}`, 10, 60_000)
    const roomId = assertId((await params).id, ROOM_ID)
    await closeRoom(firestoreDocDb(), { roomId, uid: user.uid })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
