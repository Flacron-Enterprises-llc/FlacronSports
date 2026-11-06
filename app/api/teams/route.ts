import { NextResponse } from "next/server"
import { z } from "zod"
import { getTeamFixtures } from "@/lib/sports/service"
import { SPORTS, type SportId } from "@/lib/sports/types"

const query = z.object({
  name: z.string().min(1).max(120),
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
})

export async function GET(request: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid team" }, { status: 400 })
  return NextResponse.json(await getTeamFixtures(parsed.data.name, parsed.data.sport))
}
