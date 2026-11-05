import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature } from "@/lib/api-auth"
import { getLeaderboard } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { clientIp, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    rateLimit(`leaderboard:${clientIp(request)}`, 60, 60_000)
    return NextResponse.json({ entries: await getLeaderboard(firestoreDocDb()) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
