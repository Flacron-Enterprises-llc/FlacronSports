import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { rateLimit } from "@/lib/rate-limit"
import { getCupRounds } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  try {
    const user = await requireUser(request)
    rateLimit(`cups:${user.uid}`, 60, 60_000)
    await requireSubscriber(user.uid)
    const { leagueId } = await params
    if (!/^\d{1,8}$/.test(leagueId)) throw new ApiError(400, "invalid_request", "Invalid competition")
    return NextResponse.json(await getCupRounds(leagueId))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
