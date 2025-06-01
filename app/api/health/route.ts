import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Test TheSportsDB API with a simple request
    let sportsApiStatus = false
    let apiMessage = ""

    try {
      const response = await fetch("https://www.thesportsdb.com/api/v1/json/3/all_leagues.php", {
        headers: {
          "User-Agent": "FlacronSport/1.0",
        },
        cache: "no-store",
      })
      sportsApiStatus = response.ok
      apiMessage = response.ok ? "Connected successfully" : `HTTP ${response.status}`
      console.log(`TheSportsDB API test: ${response.ok ? "✅ Success" : "❌ Failed"}`)
    } catch (error) {
      console.log("TheSportsDB API test failed:", error)
      sportsApiStatus = false
      apiMessage = error instanceof Error ? error.message : "Connection failed"
    }

    return NextResponse.json({
      status: sportsApiStatus ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        api: "online",
        thesportsdb: {
          status: sportsApiStatus ? "available" : "unavailable",
          message: apiMessage,
          endpoint: "https://www.thesportsdb.com/api/v1/json/3",
        },
        mockData: "disabled",
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        dataSource: "Real data only from TheSportsDB",
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
