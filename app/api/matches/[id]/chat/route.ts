import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { listMessages, postMatchMessage } from "@/lib/community/chat"
import { assertId, cleanMessage, displayNameOf, MATCH_ID } from "@/lib/community/content"
import { getMatchChatState } from "@/lib/community/engagement"
import { requireEvent } from "@/lib/community/events"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const viewer = await requireUser(request)
    await requireSubscriber(viewer.uid)
    rateLimit(`chat-read:${viewer.uid}`, 120, 60_000)
    const matchId = assertId((await params).id, MATCH_ID)
    const cursor = new URL(request.url).searchParams.get("cursor")
    const db = firestoreDocDb()
    const viewerUid = viewer.uid
    const [list, state] = await Promise.all([listMessages(db, { scope: "match", scopeId: matchId, viewerUid, cursor }), getMatchChatState(db, matchId, viewerUid)])
    return NextResponse.json({ ...list, ...state })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`chat:${user.uid}`, 10, 60_000)
    const matchId = assertId((await params).id, MATCH_ID)
    const { text } = await request.json().catch(() => ({}))
    const clean = cleanMessage(text)
    // A message depends on no kickoff or result, so a feed outage must not silence the chat.
    await requireEvent(matchId).catch((error) => {
      if (!(error instanceof ApiError && error.code === "feed_unavailable")) throw error
    })
    const result = await postMatchMessage(firestoreDocDb(), { matchId, uid: user.uid, displayName: displayNameOf(user.token), text: clean }, new Date())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
