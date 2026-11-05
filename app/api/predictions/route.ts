import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { assertId, displayNameOf, MATCH_ID } from "@/lib/community/content"
import { requireEvent } from "@/lib/community/events"
import { submitPrediction, type Prediction } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    const matchId = assertId(new URL(request.url).searchParams.get("matchId"), MATCH_ID)
    const prediction = await firestoreDocDb().get<Prediction>(`predictions/${matchId}_${user.uid}`)
    return NextResponse.json({ prediction })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`predictions:${user.uid}`, 20, 60_000)
    const { matchId, home, away } = await request.json().catch(() => ({}))
    const event = await requireEvent(assertId(matchId, MATCH_ID))
    const prediction = await submitPrediction(firestoreDocDb(), { uid: user.uid, displayName: displayNameOf(user.token), event, home, away }, new Date())
    return NextResponse.json({ prediction }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
