import { NextResponse } from "next/server"
import { apiErrorResponse, requireAdminOrCron, requireFeature } from "@/lib/api-auth"
import { audit } from "@/lib/audit"
import { pendingMatchIds, settleMatch } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { getEvent } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    await requireAdminOrCron(request)
    rateLimit("predictions-settle", 6, 60_000)
    const db = firestoreDocDb()
    let settled = 0
    let failed = 0
    for (const matchId of await pendingMatchIds(db)) {
      try {
        const event = await getEvent(matchId)
        if (event) settled += (await settleMatch(db, event)).settled
      } catch {
        failed += 1
      }
    }
    await audit("predictions.settle", "system", { settled, failed })
    return NextResponse.json({ settled, failed })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
