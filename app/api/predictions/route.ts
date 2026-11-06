import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { refreshBadgesQuietly } from "@/lib/community/badges"
import { assertId, displayNameOf, MATCH_ID } from "@/lib/community/content"
import { requireEvent } from "@/lib/community/events"
import { predictionEntrants, submitPrediction, toOwnPrediction, type Prediction } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { getRecentEntrants } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  matchId: z.string().max(64),
  home: z.number().int().optional(),
  away: z.number().int().optional(),
  winner: z.string().max(120).optional(),
  podium: z.array(z.string().max(120)).max(3).optional(),
})

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`predictions-read:${user.uid}`, 60, 60_000)
    const matchId = assertId(new URL(request.url).searchParams.get("matchId"), MATCH_ID)
    const prediction = await firestoreDocDb().get<Prediction>(`predictions/${matchId}_${user.uid}`)
    return NextResponse.json({ prediction: prediction && toOwnPrediction(prediction) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`predictions:${user.uid}`, 20, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid prediction")
    const { matchId, ...pick } = parsed.data
    const event = await requireEvent(assertId(matchId, MATCH_ID))
    const entrants = await predictionEntrants(event, getRecentEntrants)
    const db = firestoreDocDb()
    const now = new Date()
    const prediction = await submitPrediction(db, { uid: user.uid, displayName: displayNameOf(user.token), event, ...pick, entrants }, now)
    await refreshBadgesQuietly(db, user.uid, now)
    return NextResponse.json({ prediction: toOwnPrediction(prediction) }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
