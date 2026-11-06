import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { MATCH_ADDONS, requireMember } from "@/lib/billing/require-plan"
import { getEvent, getMatchDetail } from "@/lib/sports/service"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember(request, "match-detail", 120, MATCH_ADDONS)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const { id } = await params
  if (!/^tsdb-\d{1,12}$/.test(id)) return NextResponse.json({ error: "Invalid match" }, { status: 400 })
  try {
    const event = await getEvent(id)
    if (!event) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    return NextResponse.json(await getMatchDetail(event))
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return apiErrorResponse(error)
    return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 })
  }
}
