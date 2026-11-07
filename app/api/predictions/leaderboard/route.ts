import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireFeature, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { PREDICTION_SPORTS } from "@/lib/community/pick-rules"
import { getLeaderboard } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`leaderboard:${user.uid}`, 60, 60_000)
    const asked = new URL(request.url).searchParams.get("sport")
    const sport = PREDICTION_SPORTS.find((id) => id === asked)
    if (asked && !sport) throw new ApiError(400, "invalid_request", "Unknown sport")
    return NextResponse.json({ entries: await getLeaderboard(firestoreDocDb(), sport) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
