// Sports API Service using TheSportsDB
// Free sports data API with comprehensive coverage - No API key required

export interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: "LIVE" | "FT" | "SCHEDULED" | "POSTPONED"
  minute?: number
  league: string
  date: string
  venue?: string
  statusDescription?: string
  sport?: string
}

export class SportsApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = "https://www.thesportsdb.com/api/v1/json/3"
  }

  /**
   * Fetch today's matches with better error handling
   */
  async getTodayMatches(): Promise<Match[]> {
    const today = new Date().toISOString().split("T")[0]

    try {
      console.log(`Fetching matches for ${today}`)
      const response = await fetch(`${this.baseUrl}/eventsday.php?d=${today}&s=Soccer`, {
        headers: {
          "User-Agent": "FlacronSport/1.0",
        },
      })

      if (!response.ok) {
        console.error(`TheSportsDB API error: ${response.status} ${response.statusText}`)
        return []
      }

      const data = await response.json()
      console.log("TheSportsDB response:", data)

      if (!data || !data.events) {
        console.log("No events found for today")
        return []
      }

      const matches = this.transformEvents(data.events, "Soccer")
      console.log(`Transformed ${matches.length} matches`)
      return matches
    } catch (error) {
      console.error("Error fetching today matches:", error)
      return []
    }
  }

  /**
   * Fetch yesterday's completed matches
   */
  async getYesterdayMatches(): Promise<Match[]> {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateString = yesterday.toISOString().split("T")[0]

    try {
      console.log(`Fetching matches for ${dateString}`)
      const response = await fetch(`${this.baseUrl}/eventsday.php?d=${dateString}&s=Soccer`, {
        headers: {
          "User-Agent": "FlacronSport/1.0",
        },
      })

      if (!response.ok) {
        console.error(`TheSportsDB API error: ${response.status} ${response.statusText}`)
        return []
      }

      const data = await response.json()

      if (!data || !data.events) {
        console.log("No events found for yesterday")
        return []
      }

      // Filter only finished matches
      const finishedMatches = data.events.filter(
        (event: any) => event.strStatus === "Match Finished" || event.intHomeScore !== null,
      )

      const matches = this.transformEvents(finishedMatches, "Soccer")
      console.log(`Found ${matches.length} finished matches for yesterday`)
      return matches
    } catch (error) {
      console.error("Error fetching yesterday matches:", error)
      return []
    }
  }

  /**
   * Fetch live matches (today's matches that might be live)
   */
  async getLiveMatches(sport = "Soccer"): Promise<Match[]> {
    try {
      const today = new Date().toISOString().split("T")[0]
      console.log(`Fetching ${sport} matches for ${today}`)

      const response = await fetch(`${this.baseUrl}/eventsday.php?d=${today}&s=${sport}`, {
        headers: {
          "User-Agent": "FlacronSport/1.0",
        },
      })

      if (!response.ok) {
        console.error(`TheSportsDB API error for ${sport}: ${response.status} ${response.statusText}`)
        return []
      }

      const data = await response.json()

      if (!data || !data.events) {
        console.log(`No events found for today in ${sport}`)
        return []
      }

      const matches = this.transformEvents(data.events, sport)
      console.log(`Found ${matches.length} ${sport} matches`)
      return matches
    } catch (error) {
      console.error(`Error fetching live ${sport} matches:`, error)
      return []
    }
  }

  /**
   * Fetch matches for a specific date
   */
  async getMatchesByDate(date: string): Promise<Match[]> {
    try {
      const response = await fetch(`${this.baseUrl}/eventsday.php?d=${date}&s=Soccer`, {
        headers: {
          "User-Agent": "FlacronSport/1.0",
        },
      })

      if (!response.ok) {
        console.error(`TheSportsDB API error: ${response.status} ${response.statusText}`)
        return []
      }

      const data = await response.json()

      if (!data || !data.events) {
        return []
      }

      return this.transformEvents(data.events, "Soccer")
    } catch (error) {
      console.error("Error fetching matches by date:", error)
      return []
    }
  }

  /**
   * Fetch matches by sport
   */
  async getMatchesBySport(sport: string): Promise<Match[]> {
    try {
      const today = new Date().toISOString().split("T")[0]
      const response = await fetch(`${this.baseUrl}/eventsday.php?d=${today}&s=${sport}`, {
        headers: {
          "User-Agent": "FlacronSport/1.0",
        },
      })

      if (!response.ok) {
        console.error(`TheSportsDB API error for ${sport}: ${response.status} ${response.statusText}`)
        return []
      }

      const data = await response.json()

      if (!data || !data.events) {
        return []
      }

      return this.transformEvents(data.events, sport)
    } catch (error) {
      console.error(`Error fetching ${sport} matches:`, error)
      return []
    }
  }

  /**
   * Transform TheSportsDB events to our Match interface
   */
  private transformEvents(events: any[], sport?: string): Match[] {
    if (!Array.isArray(events)) {
      console.warn("Events is not an array:", events)
      return []
    }

    return events
      .filter((event) => {
        if (!event || !event.strHomeTeam || !event.strAwayTeam) {
          console.warn("Invalid event data:", event)
          return false
        }
        return true
      })
      .map((event: any) => {
        try {
          return {
            id: event.idEvent || `event-${Date.now()}-${Math.random()}`,
            homeTeam: event.strHomeTeam || "Unknown Team",
            awayTeam: event.strAwayTeam || "Unknown Team",
            homeScore: this.parseScore(event.intHomeScore),
            awayScore: this.parseScore(event.intAwayScore),
            status: this.mapStatus(event.strStatus),
            minute: undefined, // TheSportsDB free tier doesn't provide live minutes
            league: event.strLeague || "Unknown League",
            date: this.parseDate(event.dateEvent, event.strTime),
            venue: event.strVenue || undefined,
            statusDescription: event.strStatus || undefined,
            sport: this.formatSportName(sport || event.strSport || "Soccer"),
          }
        } catch (error) {
          console.error("Error transforming event:", event, error)
          return null
        }
      })
      .filter(Boolean) as Match[]
  }

  /**
   * Parse score safely
   */
  private parseScore(score: any): number {
    if (score === null || score === undefined || score === "") {
      return 0
    }
    const parsed = Number.parseInt(score)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  /**
   * Parse date safely
   */
  private parseDate(dateEvent: string, strTime: string): string {
    try {
      if (dateEvent) {
        const time = strTime || "00:00"
        return `${dateEvent}T${time}:00Z`
      }
      return new Date().toISOString()
    } catch (error) {
      console.error("Error parsing date:", dateEvent, strTime, error)
      return new Date().toISOString()
    }
  }

  /**
   * Map TheSportsDB status to our status enum
   */
  private mapStatus(apiStatus: string): Match["status"] {
    if (!apiStatus) return "SCHEDULED"

    switch (apiStatus.toLowerCase()) {
      case "match finished":
      case "ft":
      case "finished":
        return "FT"
      case "live":
      case "in play":
      case "1st half":
      case "2nd half":
      case "half time":
        return "LIVE"
      case "postponed":
      case "delayed":
      case "canceled":
      case "suspended":
        return "POSTPONED"
      case "not started":
      case "scheduled":
      default:
        return "SCHEDULED"
    }
  }
}

export const sportsApiService = new SportsApiService()

export const getAvailableSports = () => [
  "Soccer",
  "Basketball",
  "Ice Hockey",
  "Tennis",
  "American Football",
  "Baseball",
  "Cricket",
  "Rugby",
]

export const formatSportName = (sport: string): string => {
  const sportNames: Record<string, string> = {
    Soccer: "Football",
    Basketball: "Basketball",
    Tennis: "Tennis",
    "Ice Hockey": "Ice Hockey",
    "American Football": "American Football",
    Baseball: "Baseball",
    Cricket: "Cricket",
    Rugby: "Rugby",
  }
  return sportNames[sport] || sport
}
