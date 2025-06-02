import { NextResponse } from "next/server"
import http from "http"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get("sport") || "Soccer"

    console.log(`🏈 Fetching ${sport} matches from RapidAPI...`)

    let matches: any[] = []

    // Handle "All Events Today" option
    if (sport === "All") {
      const options = {
        method: 'GET',
        hostname: 'api-football-v1.p.rapidapi.com',
        port: null,
        path: '/v2/fixtures/live',
          headers: {
          'x-rapidapi-key': '***REMOVED***',
          'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
        }
      };

      const req = http.request(options, function (res) {
        const chunks: Buffer[] = [];

        res.on('data', function (chunk) {
          chunks.push(chunk);
        });

        res.on('end', function () {
          const body = Buffer.concat(chunks);
          console.log(body.toString());
        });
      });

      req.end();

      return NextResponse.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
        count: 0,
        sport: sport,
        source: "RapidAPI Live Matches",
      })
    }

    // Handle Football with RapidAPI endpoint
    if (sport === "Football") {
      const options = {
        method: 'GET',
        hostname: 'api-football-v1.p.rapidapi.com',
        port: null,
        path: '/v2/fixtures/upcoming',
          headers: {
          'x-rapidapi-key': '***REMOVED***',
          'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
        }
      };

      const req = http.request(options, function (res) {
        const chunks: Buffer[] = [];

        res.on('data', function (chunk) {
          chunks.push(chunk);
        });

        res.on('end', function () {
          const body = Buffer.concat(chunks);
          console.log(body.toString());
        });
      });

      req.end();

        return NextResponse.json({
          success: true,
        data: [],
          timestamp: new Date().toISOString(),
        count: 0,
          sport: sport,
        source: "RapidAPI Live Matches",
        })
    }

    // For other sports, use the regular endpoint with date range
    const dates = []
    const today = new Date()

    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date.toISOString().split("T")[0])
    }

    let allMatches: any[] = []

    for (const dateString of dates) {
      try {
        const options = {
          method: 'GET',
          hostname: 'api-football-v1.p.rapidapi.com',
          port: null,
          path: '/v2/fixtures/live',
          headers: {
            'x-rapidapi-key': '***REMOVED***',
            'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
          }
        };

        const req = http.request(options, function (res) {
          const chunks: Buffer[] = [];

          res.on('data', function (chunk) {
            chunks.push(chunk);
          });

          res.on('end', function () {
            const body = Buffer.concat(chunks);
            console.log(body.toString());
          });
        });

        req.end();

        return NextResponse.json({
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
          count: 0,
          sport: sport,
          source: "RapidAPI Live Matches",
                })
      } catch (error) {
        console.error(`Error fetching ${sport} for ${dateString}:`, error)
      }
    }

    allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    console.log(`✅ Total processed ${allMatches.length} ${sport} matches from TheSportsDB`)

    return NextResponse.json({
      success: true,
      data: allMatches,
      timestamp: new Date().toISOString(),
      count: allMatches.length,
      sport: sport,
      source: "TheSportsDB",
      dateRange: `${dates[0]} to ${dates[dates.length - 1]}`,
    })
  } catch (error) {
    console.error("❌ Error in today matches API:", error)

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
