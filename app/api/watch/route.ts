import { NextResponse } from "next/server"
import { z } from "zod"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { getWatchFeed } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"

const name = z.string().max(120).optional()

const query = z.object({
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
  q: z.string().max(80).optional(),
  competition: name,
  team: name,
  athlete: name,
  tournament: name,
  race: name,
  session: name,
  series: name,
  format: name,
  watchable: z.literal("1").optional(),
})

export async function GET(request: Request) {
  try {
    await requireMember(request, "watch", 60)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  const { sport, watchable, ...filters } = parsed.data
  try {
    return NextResponse.json(await getWatchFeed(sport, new Date(), { ...filters, watchable: watchable === "1" }))
  } catch {
    return NextResponse.json({ error: "Watch is temporarily unavailable" }, { status: 503 })
  }
}
