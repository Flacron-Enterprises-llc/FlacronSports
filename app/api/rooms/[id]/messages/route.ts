import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { listMessages } from "@/lib/community/chat"
import { assertId, cleanMessage, ROOM_ID } from "@/lib/community/content"
import { assertRoomMember, postRoomMessage } from "@/lib/community/rooms"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    const roomId = assertId((await params).id, ROOM_ID)
    const db = firestoreDocDb()
    await assertRoomMember(db, roomId, user.uid)
    const cursor = new URL(request.url).searchParams.get("cursor")
    return NextResponse.json(await listMessages(db, { scope: "room", scopeId: roomId, viewerUid: user.uid, cursor }))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`room-chat:${user.uid}`, 20, 60_000)
    const roomId = assertId((await params).id, ROOM_ID)
    const { text } = await request.json().catch(() => ({}))
    const result = await postRoomMessage(firestoreDocDb(), { roomId, uid: user.uid, text: cleanMessage(text) }, new Date())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
