import { NextResponse } from "next/server"
import { getStandings } from "@/lib/sports/service"

export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  if (!/^\d{1,8}$/.test(leagueId)) return NextResponse.json({ error: "Invalid league" }, { status: 400 })
  return NextResponse.json(await getStandings(leagueId))
}
