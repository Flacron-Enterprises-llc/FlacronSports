import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { refreshBadges } from "@/lib/community/badges"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Also how a follow or a settled result reaches the badges shown to others. */
export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`badges:${user.uid}`, 30, 60_000)
    return NextResponse.json({ badges: await refreshBadges(firestoreDocDb(), user.uid, new Date()) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
