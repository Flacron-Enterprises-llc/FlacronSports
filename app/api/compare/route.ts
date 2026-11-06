import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { rateLimit } from "@/lib/rate-limit"
import { compareTeams, TeamNotFound } from "@/lib/sports/compare"
import { SPORTS, type SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const query = z.object({
  first: z.string().trim().min(1).max(120),
  second: z.string().trim().min(1).max(120),
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
})

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const { plan } = await getEffectiveAccess(user.uid)
    if (plan === "free") throw new ApiError(403, "plan_required", "Comparison needs the Plus or Premium plan")
    rateLimit(`compare:${user.uid}`, 20, 60_000)
    const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Choose two teams")
    const { first, second, sport } = parsed.data
    if (first.toLowerCase() === second.toLowerCase()) throw new ApiError(400, "same_team", "Choose two different teams")
    return NextResponse.json(await compareTeams(first, second, sport, plan === "premium" ? "advanced" : "basic"))
  } catch (error) {
    if (error instanceof TeamNotFound) return NextResponse.json({ error: "team_not_found", code: "team_not_found", team: error.name }, { status: 404 })
    return apiErrorResponse(error)
  }
}
