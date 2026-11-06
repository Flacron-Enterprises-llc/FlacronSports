import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { rateLimit } from "@/lib/rate-limit"
import { searchPlayers } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`player-search:${user.uid}`, 40, 60_000)
    await requireSubscriber(user.uid)
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
    if (q.length < 2 || q.length > 80) throw new ApiError(400, "invalid_request", "Type at least two letters")
    const players = await searchPlayers(q)
    return NextResponse.json({ players: players.map(({ id, name, team }) => ({ id, name, team })) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
