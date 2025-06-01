import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get("sport") || "Soccer"
    const all = searchParams.get("all") === "true"

    console.log(`🏈 Fetching live ${sport} matches from TheSportsDB...`)

    const allMatches = []

    if (sport === "Soccer" || all) {
      // Use the specific latest soccer endpoint for football
      const apiUrl = "https://www.thesportsdb.com/api/v1/json/3/latestsoccer.php"
      console.log("Fetching latest soccer matches:", apiUrl)

      try {
        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "FlacronSport/1.0",
          },
          cache: "no-store",
        })

        if (response.ok) {
          const data = await response.json()
          console.log("Latest soccer API response received")

          if (data && data.teams && data.teams.Match && Array.isArray(data.teams.Match)) {
            const soccerMatches = data.teams.Match.map((match, index) => ({
              id: match.Id || `soccer-${Date.now()}-${index}`,
              homeTeam: match.HomeTeam || "Unknown Team",
              awayTeam: match.AwayTeam || "Unknown Team",
              homeScore: Number.parseInt(match.HomeGoals) || 0,
              awayScore: Number.parseInt(match.AwayGoals) || 0,
              status: match.Time && match.Time.includes("'") ? "LIVE" : "FT",
              minute: match.Time && match.Time.includes("'") ? match.Time : undefined,
              league: match.League || "Unknown League",
              date: match.Date || new Date().toISOString(),
              venue: match.Stadium || match.Location,
              sport: "Football",
              round: match.Round,
            }))

            allMatches.push(...soccerMatches)
            console.log(`✅ Added ${soccerMatches.length} latest soccer matches`)
          }
        }
      } catch (error) {
        console.error("Error fetching latest soccer:", error)
      }
    }

    if (all) {
      // Get matches from other sports
      const otherSports = ["Basketball", "Tennis", "Ice Hockey", "American Football", "Baseball"]

      for (const sportName of otherSports) {
        try {
          // Try current date and next few days
          const dates = []
          const today = new Date()

          for (let i = 0; i < 3; i++) {
            const date = new Date(today)
            date.setDate(today.getDate() + i)
            dates.push(date.toISOString().split("T")[0])
          }

          for (const dateString of dates) {
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateString}&s=${sportName}`
            console.log(`Fetching ${sportName} for ${dateString}`)

            const response = await fetch(apiUrl, {
              headers: {
                "User-Agent": "FlacronSport/1.0",
              },
              cache: "no-store",
            })

            if (response.ok) {
              const data = await response.json()
              if (data && data.events && Array.isArray(data.events)) {
                const sportMatches = data.events
                  .filter((event) => event && event.strHomeTeam && event.strAwayTeam)
                  .slice(0, 5) // Limit to 5 matches per sport per date
                  .map((event) => ({
                    id: event.idEvent || `event-${sportName}-${dateString}-${Math.random()}`,
                    homeTeam: event.strHomeTeam,
                    awayTeam: event.strAwayTeam,
                    homeScore: Number.parseInt(event.intHomeScore) || 0,
                    awayScore: Number.parseInt(event.intAwayScore) || 0,
                    status:
                      event.strStatus === "Match Finished" ? "FT" : event.strStatus === "Live" ? "LIVE" : "SCHEDULED",
                    league: event.strLeague || "Unknown League",
                    date: event.dateEvent
                      ? `${event.dateEvent}T${event.strTime || "00:00"}:00Z`
                      : new Date().toISOString(),
                    venue: event.strVenue,
                    sport: sportName === "Soccer" ? "Football" : sportName,
                    eventDate: dateString,
                  }))
                allMatches.push(...sportMatches)
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching ${sportName}:`, error)
        }
      }
    } else if (sport !== "Soccer") {
      // Get matches for a single non-soccer sport across multiple dates
      const dates = []
      const today = new Date()

      // Try today and next few days
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        dates.push(date.toISOString().split("T")[0])
      }

      for (const dateString of dates) {
        try {
          const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateString}&s=${sport}`
          console.log(`Fetching ${sport} for ${dateString}`)

          const response = await fetch(apiUrl, {
            headers: {
              "User-Agent": "FlacronSport/1.0",
            },
            cache: "no-store",
          })

          if (response.ok) {
            const data = await response.json()
            if (data && data.events && Array.isArray(data.events)) {
              const matches = data.events
                .filter((event) => event && event.strHomeTeam && event.strAwayTeam)
                .map((event) => ({
                  id: event.idEvent || `event-${sport}-${dateString}-${Math.random()}`,
                  homeTeam: event.strHomeTeam,
                  awayTeam: event.strAwayTeam,
                  homeScore: Number.parseInt(event.intHomeScore) || 0,
                  awayScore: Number.parseInt(event.intAwayScore) || 0,
                  status:
                    event.strStatus === "Match Finished" ? "FT" : event.strStatus === "Live" ? "LIVE" : "SCHEDULED",
                  league: event.strLeague || "Unknown League",
                  date: event.dateEvent
                    ? `${event.dateEvent}T${event.strTime || "00:00"}:00Z`
                    : new Date().toISOString(),
                  venue: event.strVenue,
                  sport: sport === "Soccer" ? "Football" : sport,
                  eventDate: dateString,
                }))
              allMatches.push(...matches)
            }
          }
        } catch (error) {
          console.error(`Error fetching ${sport} for ${dateString}:`, error)
        }
      }
    }

    // Sort matches by date
    allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    console.log(`✅ Total processed ${allMatches.length} matches from TheSportsDB`)

    return NextResponse.json({
      success: true,
      data: allMatches,
      timestamp: new Date().toISOString(),
      count: allMatches.length,
      sport: all ? "Multiple" : sport,
      source: sport === "Soccer" || all ? "TheSportsDB Latest Soccer + Events" : "TheSportsDB",
    })
  } catch (error) {
    console.error("❌ Error in live matches API:", error)

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
