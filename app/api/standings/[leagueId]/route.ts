import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-auth"
import { rateLimitClient } from "@/lib/rate-limit"
import { getStandings } from "@/lib/sports/service"

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  try {
    rateLimitClient(request, "standings", { visitor: 60, shared: 600 }, 60_000)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const { leagueId } = await params
  if (!/^\d{1,8}$/.test(leagueId)) return NextResponse.json({ error: "Invalid league" }, { status: 400 })
  return NextResponse.json(await getStandings(leagueId))
}
