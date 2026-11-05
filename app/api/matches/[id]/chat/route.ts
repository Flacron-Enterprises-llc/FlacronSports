import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { listMessages, postMatchMessage } from "@/lib/community/chat"
import { assertId, cleanMessage, displayNameOf, MATCH_ID } from "@/lib/community/content"
import { requireEvent } from "@/lib/community/events"
import { firestoreDocDb } from "@/lib/doc-db"
import { clientIp, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    rateLimit(`chat-read:${clientIp(request)}`, 120, 60_000)
    const matchId = assertId((await params).id, MATCH_ID)
    const viewer = request.headers.has("authorization") ? await requireUser(request) : null
    const cursor = new URL(request.url).searchParams.get("cursor")
    return NextResponse.json(await listMessages(firestoreDocDb(), { scope: "match", scopeId: matchId, viewerUid: viewer?.uid ?? null, cursor }))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`chat:${user.uid}`, 10, 60_000)
    const matchId = assertId((await params).id, MATCH_ID)
    const { text } = await request.json().catch(() => ({}))
    const clean = cleanMessage(text)
    await requireEvent(matchId)
    const result = await postMatchMessage(firestoreDocDb(), { matchId, uid: user.uid, displayName: displayNameOf(user.token), text: clean }, new Date())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
