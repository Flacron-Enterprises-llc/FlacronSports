// Gemini AI Service for generating sports content
// This service handles all AI content generation using Google's Gemini API

interface MatchData {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  league: string
  date: string
  keyEvents?: string[]
  statistics?: Record<string, any>
}

interface GeneratedContent {
  title: string
  content: string
  summary: string
  tags: string[]
  seoMetaDescription: string
}

export class GeminiService {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || ""
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta"
    this.model = "gemini-1.5-pro-latest"
  }

  /**
   * Generate a comprehensive blog post from match data
   */
  async generateBlogPost(matches: MatchData[]): Promise<GeneratedContent> {
    const prompt = this.createBlogPrompt(matches)

    try {
      const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      })

      const data = await response.json()
      return this.parseGeneratedContent(data.candidates[0].content.parts[0].text)
    } catch (error) {
      console.error("Error generating blog post:", error)
      throw new Error("Failed to generate blog post")
    }
  }

  /**
   * Generate newsletter content
   */
  async generateNewsletter(matches: MatchData[]): Promise<string> {
    const prompt = this.createNewsletterPrompt(matches)

    try {
      const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      })

      const data = await response.json()
      return data.candidates[0].content.parts[0].text
    } catch (error) {
      console.error("Error generating newsletter:", error)
      throw new Error("Failed to generate newsletter")
    }
  }

  /**
   * Create blog post prompt
   */
  private createBlogPrompt(matches: MatchData[]): string {
    const matchSummaries = matches
      .map((match) => `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} (${match.league})`)
      .join("\n")

    return `
Generate a comprehensive sports blog post based on the following match results:

${matchSummaries}

Requirements:
1. Create an engaging, SEO-friendly title
2. Write a 500-600 word article covering:
   - Key match highlights and turning points
   - Outstanding individual performances
   - Tactical analysis where relevant
   - Impact on league standings/competitions
3. Include a brief summary (2-3 sentences)
4. Suggest 5 relevant tags
5. Create a meta description (150-160 characters)

Format the response as JSON with the following structure:
{
  "title": "SEO-friendly title",
  "content": "Full article content in markdown format",
  "summary": "Brief summary",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "seoMetaDescription": "Meta description"
}

Write in an engaging, professional sports journalism style. Focus on facts and analysis rather than speculation.
`
  }

  /**
   * Create newsletter prompt
   */
  private createNewsletterPrompt(matches: MatchData[]): string {
    const matchSummaries = matches
      .map((match) => `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} (${match.league})`)
      .join("\n")

    return `
Create a daily sports newsletter digest based on these match results:

${matchSummaries}

Requirements:
1. Start with a catchy subject line
2. Brief introduction (2-3 sentences)
3. Highlight 3-4 most significant results with brief analysis
4. Include a "Match of the Day" section
5. End with a preview of upcoming fixtures
6. Keep total length under 300 words
7. Use a conversational, engaging tone
8. Format for email (HTML-friendly)

Focus on the most exciting and newsworthy aspects of the matches.
`
  }

  /**
   * Parse generated content from Gemini response
   */
  private parseGeneratedContent(text: string): GeneratedContent {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(text)
      return parsed
    } catch (error) {
      // If JSON parsing fails, extract content manually
      return {
        title: "Daily Sports Roundup",
        content: text,
        summary: text.substring(0, 200) + "...",
        tags: ["sports", "football", "analysis"],
        seoMetaDescription: text.substring(0, 150) + "...",
      }
    }
  }

  /**
   * Generate match predictions (Premium feature)
   */
  async generatePredictions(upcomingMatches: any[]): Promise<string> {
    const prompt = `
Analyze the following upcoming matches and provide predictions based on recent form, head-to-head records, and team statistics:

${upcomingMatches.map((match) => `${match.homeTeam} vs ${match.awayTeam}`).join("\n")}

Provide:
1. Score predictions with confidence levels
2. Key factors influencing each prediction
3. Players to watch
4. Betting insights (responsible gambling disclaimer)

Keep analysis factual and data-driven.
`

    try {
      const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      })

      const data = await response.json()
      return data.candidates[0].content.parts[0].text
    } catch (error) {
      console.error("Error generating predictions:", error)
      throw new Error("Failed to generate predictions")
    }
  }
}

export const geminiService = new GeminiService()
