import { NextResponse } from "next/server"
import { geminiService } from "@/lib/gemini-service"
import { sportsApiService } from "@/lib/sports-api"

export async function POST() {
  try {
    // Get yesterday's matches
    const matches = await sportsApiService.getYesterdayMatches()

    if (matches.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No matches found for content generation",
      })
    }

    // Filter significant matches
    const significantMatches = matches.filter(
      (match) => match.status === "FT" && (match.homeScore > 0 || match.awayScore > 0),
    )

    if (significantMatches.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No significant matches found",
      })
    }

    // Generate content using Gemini
    const content = await geminiService.generateBlogPost(significantMatches)

    // Here you would save to database
    // await saveBlogPost(content)

    return NextResponse.json({
      success: true,
      data: content,
      matchesProcessed: significantMatches.length,
    })
  } catch (error) {
    console.error("Error generating content:", error)
    return NextResponse.json({ success: false, error: "Failed to generate content" }, { status: 500 })
  }
}
