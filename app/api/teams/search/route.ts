import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { rateLimit } from "@/lib/rate-limit"
import { searchTeams } from "@/lib/sports/service"
import { requireDataAccess } from "@/lib/billing/require-plan"
import { SPORTS, type SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    await requireDataAccess(user)
    rateLimit(`team-search:${user.uid}`, 40, 60_000)
    const params = new URL(request.url).searchParams
    const q = (params.get("q") ?? "").trim()
    const sport = SPORTS.find((item) => item.id === params.get("sport"))?.id as SportId | undefined
    if (q.length < 2 || q.length > 80) throw new ApiError(400, "invalid_request", "Type at least two letters")
    return NextResponse.json({ teams: await searchTeams(q, sport) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
