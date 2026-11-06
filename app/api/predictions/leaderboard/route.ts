import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
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
    return NextResponse.json({ entries: await getLeaderboard(firestoreDocDb()) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
