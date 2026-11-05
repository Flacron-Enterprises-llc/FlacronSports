import { NextResponse } from "next/server"
import { getEvent } from "@/lib/sports/service"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const event = await getEvent((await params).id)
    if (!event) return NextResponse.json({ error: "Match not found" }, { status: 404 })
    return NextResponse.json({ event, fetchedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: "Match data is temporarily unavailable" }, { status: 503 })
  }
}
