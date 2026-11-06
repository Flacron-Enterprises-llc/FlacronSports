import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireDataAccess } from "@/lib/billing/require-plan"
import { rateLimit } from "@/lib/rate-limit"
import { getPlayer, getPlayerMoves } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    await requireDataAccess(user)
    rateLimit(`player:${user.uid}`, 60, 60_000)
    const player = await getPlayer((await params).id).catch(() => {
      throw new ApiError(503, "provider_unavailable", "Sports data is temporarily unavailable")
    })
    if (!player) throw new ApiError(404, "not_found", "Player not found")
    // A failed lookup of the moves must not take the profile down with it.
    const career = await getPlayerMoves(player.id).catch(() => null)
    return NextResponse.json({ player, career })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
