import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { rateLimitClient } from "@/lib/rate-limit"
import { getEvent, getMatchDetail } from "@/lib/sports/service"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^tsdb-\d{1,12}$/.test(id)) return NextResponse.json({ error: "Invalid match" }, { status: 400 })
  try {
    rateLimitClient(request, "match-detail", { visitor: 120, shared: 1500 }, 60_000)
    const event = await getEvent(id)
    if (!event) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    return NextResponse.json(await getMatchDetail(event))
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return apiErrorResponse(error)
    return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 })
  }
}
