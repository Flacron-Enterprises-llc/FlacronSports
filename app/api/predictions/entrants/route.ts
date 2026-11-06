import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser } from "@/lib/api-auth"
import { assertId, MATCH_ID } from "@/lib/community/content"
import { requireEvent } from "@/lib/community/events"
import { predictionEntrants } from "@/lib/community/predictions"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { getRecentEntrants } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Who can be picked for a race podium. Empty when the feed has no recent field to offer. */
export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`predictions-read:${user.uid}`, 60, 60_000)
    const event = await requireEvent(assertId(new URL(request.url).searchParams.get("matchId"), MATCH_ID))
    return NextResponse.json({ entrants: await predictionEntrants(event, getRecentEntrants) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
