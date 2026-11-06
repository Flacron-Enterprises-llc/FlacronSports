import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { MATCH_ADDONS, requireMember } from "@/lib/billing/require-plan"
import { getEvent } from "@/lib/sports/service"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember(request, "match", 120, MATCH_ADDONS)
  } catch (error) {
    return apiErrorResponse(error)
  }
  try {
    const event = await getEvent((await params).id)
    if (!event) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    return NextResponse.json({ event, fetchedAt: event.sourceUpdatedAt })
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return apiErrorResponse(error)
    return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 })
  }
}
