import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { comparisonTier, requireSubscriber } from "@/lib/billing/require-plan"
import { rateLimit } from "@/lib/rate-limit"
import { comparePlayers, PlayerNotFound } from "@/lib/sports/compare"
import { isPlayerId } from "@/lib/sports/player"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const query = z.object({ first: z.string().refine(isPlayerId), second: z.string().refine(isPlayerId) })

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`compare:${user.uid}`, 20, 60_000)
    await requireSubscriber(user.uid)
    const tier = await comparisonTier(user.uid)
    const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Choose two players")
    const { first, second } = parsed.data
    if (first === second) throw new ApiError(400, "same_player", "Choose two different players")
    return NextResponse.json(await comparePlayers(first, second, tier))
  } catch (error) {
    if (error instanceof PlayerNotFound) return NextResponse.json({ error: "player_not_found", code: "player_not_found" }, { status: 404 })
    return apiErrorResponse(error)
  }
}
