import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { getStandings } from "@/lib/sports/service"

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  try {
    await requireMember(request, "standings", 60)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const { leagueId } = await params
  if (!/^\d{1,8}$/.test(leagueId)) return NextResponse.json({ error: "Invalid league" }, { status: 400 })
  return NextResponse.json(await getStandings(leagueId))
}
