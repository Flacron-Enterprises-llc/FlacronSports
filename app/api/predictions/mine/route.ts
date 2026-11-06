import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { listMyPredictions } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { getEvent } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`predictions-mine:${user.uid}`, 30, 60_000)
    const predictions = await listMyPredictions(firestoreDocDb(), user.uid, new Date(), (id) => getEvent(id, { anyCoverage: true }))
    return NextResponse.json({ predictions })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
