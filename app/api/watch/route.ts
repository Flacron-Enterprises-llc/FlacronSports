import { NextResponse } from "next/server"
import { z } from "zod"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { getWatchFeed } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"

const query = z.object({
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
  team: z.string().max(80).optional(),
  competition: z.string().max(120).optional(),
})

export async function GET(request: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  const { sport, team, competition } = parsed.data
  try {
    return NextResponse.json(await getWatchFeed(sport, new Date(), { team, competition }))
  } catch {
    return NextResponse.json({ error: "Watch is temporarily unavailable" }, { status: 503 })
  }
}
