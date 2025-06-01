import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get("sport") || "Soccer"

    console.log(`🏈 Fetching ${sport} results from TheSportsDB...`)

    // Try multiple past dates to get more results
    const dates = []
    const today = new Date()

    // Try past 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      dates.push(date.toISOString().split("T")[0])
    }

    const allMatches = []

    // Fetch matches for multiple past dates
    for (const dateString of dates) {
      try {
        const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateString}&s=${sport}`
        console.log(`Fetching ${sport} for ${dateString}:`, apiUrl)

        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "FlacronSport/1.0",
          },
          cache: "no-store",
        })

        if (response.ok) {
          const data = await response.json()
          if (data && data.events && Array.isArray(data.events)) {
            console.log(`Found ${data.events.length} events for ${dateString}`)

            for (const event of data.events) {
              if (event && event.strHomeTeam && event.strAwayTeam) {
                // Only include finished matches
                if (event.strStatus === "Match Finished" || event.intHomeScore !== null) {
                  allMatches.push({
                    id: event.idEvent || `event-${dateString}-${Math.random()}`,
                    homeTeam: event.strHomeTeam,
                    awayTeam: event.strAwayTeam,
                    homeScore: Number.parseInt(event.intHomeScore) || 0,
                    awayScore: Number.parseInt(event.intAwayScore) || 0,
                    status: "FT",
                    league: event.strLeague || "Unknown League",
                    date: event.dateEvent
                      ? `${event.dateEvent}T${event.strTime || "00:00"}:00Z`
                      : new Date().toISOString(),
                    venue: event.strVenue,
                    sport: sport === "Soccer" ? "Football" : sport,
                    eventDate: dateString,
                  })
                }
              }
            }
          }
        } else {
          console.log(`No data for ${sport} on ${dateString}`)
        }
      } catch (error) {
        console.error(`Error fetching ${sport} for ${dateString}:`, error)
      }
    }

    // Sort matches by date (most recent first)
    allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    console.log(`✅ Total processed ${allMatches.length} finished ${sport} matches from TheSportsDB`)

    return NextResponse.json({
      success: true,
      data: allMatches,
      timestamp: new Date().toISOString(),
      count: allMatches.length,
      sport: sport,
      source: "TheSportsDB",
      dateRange: `${dates[dates.length - 1]} to ${dates[0]}`,
    })
  } catch (error) {
    console.error("❌ Error in yesterday matches API:", error)

    return NextResponse.json({
      success: false,
      data: [],
      timestamp: new Date().toISOString(),
      count: 0,
      sport: new URL(request.url).searchParams.get("sport") || "Soccer",
      source: "TheSportsDB",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
