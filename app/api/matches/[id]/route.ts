import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { rateLimitClient } from "@/lib/rate-limit"
import { getEvent } from "@/lib/sports/service"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimitClient(request, "match", { visitor: 120, shared: 1500 }, 60_000)
    const event = await getEvent((await params).id)
    if (!event) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    return NextResponse.json({ event, fetchedAt: event.sourceUpdatedAt })
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return apiErrorResponse(error)
    return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 })
  }
}
