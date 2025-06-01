import { NextResponse } from "next/server"
import { sportsApiService } from "@/lib/sports-api"
import { saveMatchData } from "@/lib/firebase-config"

export async function GET(request: Request, { params }: { params: { date: string } }) {
  try {
    const { date } = params

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ success: false, error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
    }

    console.log(`🏈 Fetching matches for ${date} from TheSportsDB...`)

    const matches = await sportsApiService.getMatchesByDate(date)
    console.log(`📊 Found ${matches.length} matches for ${date}`)

    // Store matches in Firebase if available
    let savedCount = 0
    if (matches.length > 0) {
      try {
        savedCount = await saveMatchData(matches)
        console.log(`💾 Saved ${savedCount} matches to Firebase`)
      } catch (error) {
        console.log("Firebase save failed, continuing without storage:", error)
      }
    }

    return NextResponse.json({
      success: true,
      data: matches,
      timestamp: new Date().toISOString(),
      count: matches.length,
      date: date,
      savedToFirebase: savedCount,
      source: "TheSportsDB",
    })
  } catch (error) {
    console.error("Error in date matches API:", error)

    return NextResponse.json({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
      count: 0,
      error: "Failed to fetch matches for date",
    })
  }
}
