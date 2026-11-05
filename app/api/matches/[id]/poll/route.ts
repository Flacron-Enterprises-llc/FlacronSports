import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { assertId, MATCH_ID } from "@/lib/community/content"
import { getMatchChatState, voteInPoll } from "@/lib/community/engagement"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`poll:${user.uid}`, 20, 60_000)
    const matchId = assertId((await params).id, MATCH_ID)
    const { option } = await request.json().catch(() => ({}))
    const db = firestoreDocDb()
    await voteInPoll(db, { matchId, uid: user.uid, option }, new Date())
    return NextResponse.json({ poll: (await getMatchChatState(db, matchId, user.uid)).poll })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
