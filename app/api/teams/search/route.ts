import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { rateLimit } from "@/lib/rate-limit"
import { searchTeams } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`team-search:${user.uid}`, 40, 60_000)
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
    if (q.length < 2 || q.length > 80) throw new ApiError(400, "invalid_request", "Type at least two letters")
    return NextResponse.json({ teams: await searchTeams(q) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
