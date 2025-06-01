import { NextResponse } from "next/server"
import { sportsApiService } from "@/lib/sports-api"

export async function GET(request: Request, { params }: { params: { eventId: string } }) {
  try {
    const { eventId } = params

    if (!eventId) {
      return NextResponse.json({ success: false, error: "Event ID is required" }, { status: 400 })
    }

    const matchDetails = await sportsApiService.getMatchDetails(eventId)

    if (!matchDetails) {
      return NextResponse.json({ success: false, error: "Match not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: matchDetails,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in match details API:", error)

    return NextResponse.json({ success: false, error: "Failed to fetch match details" }, { status: 500 })
  }
}
