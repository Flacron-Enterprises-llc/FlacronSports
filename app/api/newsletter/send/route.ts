import { NextResponse } from "next/server"
import { emailService } from "@/lib/email-service"
import { sportsApiService } from "@/lib/sports-api"

export async function POST() {
  try {
    // Get yesterday's matches for newsletter
    const matches = await sportsApiService.getYesterdayMatches()

    if (matches.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No matches found for newsletter",
      })
    }

    // Generate simple newsletter content from matches
    const newsletterContent = generateNewsletterContent(matches)

    // Send newsletter using SendGrid
    await emailService.sendDailyNewsletter(newsletterContent)

    return NextResponse.json({
      success: true,
      message: "Newsletter sent successfully",
      matchesIncluded: matches.length,
    })
  } catch (error) {
    console.error("Error sending newsletter:", error)
    return NextResponse.json({ success: false, error: "Failed to send newsletter" }, { status: 500 })
  }
}

function generateNewsletterContent(matches: any[]): string {
  const significantMatches = matches
    .filter((match) => match.status === "FT" && (match.homeScore > 0 || match.awayScore > 0))
    .slice(0, 5)

  let content = `
    <h2>🏆 Yesterday's Match Results</h2>
    <p>Here are the key results from yesterday's football action:</p>
  `

  if (significantMatches.length > 0) {
    content += `<div style="margin: 20px 0;">`

    significantMatches.forEach((match) => {
      content += `
        <div style="background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #1e40af;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af;">${match.league}</h3>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <strong>${match.homeTeam}</strong> vs <strong>${match.awayTeam}</strong>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #1e40af;">
              ${match.homeScore} - ${match.awayScore}
            </div>
          </div>
        </div>
      `
    })

    content += `</div>`
  } else {
    content += `<p>No significant matches were completed yesterday.</p>`
  }

  content += `
    <h3>📊 Coming Up Today</h3>
    <p>Don't miss today's exciting fixtures! Visit our website for live scores and real-time updates.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://flacronsport.com" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Live Scores</a>
    </div>
    
    <p>Stay tuned for more updates and analysis!</p>
    <p><strong>The FlacronSport Team</strong></p>
  `

  return content
}
