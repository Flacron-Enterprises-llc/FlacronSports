import { NextResponse } from "next/server"
import { getEvent, getMatchDetail } from "@/lib/sports/service"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^tsdb-\d{1,12}$/.test(id)) return NextResponse.json({ error: "Invalid match" }, { status: 400 })
  try {
    const event = await getEvent(id)
    if (!event) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    return NextResponse.json(await getMatchDetail(event))
  } catch {
    return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 })
  }
}
