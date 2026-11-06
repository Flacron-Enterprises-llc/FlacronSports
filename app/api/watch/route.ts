import { NextResponse } from "next/server"
import { z } from "zod"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { getWatchFeed } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"

const query = z.object({
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
  team: z.string().max(80).optional(),
  competition: z.string().max(120).optional(),
})

export async function GET(request: Request) {
  try {
    await requireMember(request, "watch", 60)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  const { sport, team, competition } = parsed.data
  try {
    return NextResponse.json(await getWatchFeed(sport, new Date(), { team, competition }))
  } catch {
    return NextResponse.json({ error: "Watch is temporarily unavailable" }, { status: 503 })
  }
}
