import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, ArrowLeft, Trophy } from "lucide-react"
import Link from "next/link"

interface BlogPostPageProps {
  params: {
    slug: string
  }
}

// Mock article data
const getArticleBySlug = (slug: string) => {
  const articles: Record<string, any> = {
    "premier-league-weekend-roundup": {
      id: 1,
      title: "Premier League Weekend Roundup: Stunning Upsets and Record-Breaking Performances",
      content: `
        <h2>Weekend Highlights</h2>
        <p>This weekend's Premier League action delivered incredible drama with Manchester United's comeback victory and Liverpool's dominant display against Chelsea.</p>
        
        <h3>Manchester United vs Arsenal - 3-2</h3>
        <p>In a thrilling encounter at Old Trafford, Manchester United staged a remarkable comeback from 2-0 down to defeat Arsenal 3-2. Goals from Bruno Fernandes, Marcus Rashford, and a late winner from Casemiro sent the home crowd into raptures.</p>
        
        <h3>Liverpool vs Chelsea - 4-1</h3>
        <p>Liverpool dominated Chelsea at Anfield with a commanding 4-1 victory. Mohamed Salah scored twice, while Darwin Núñez and Cody Gakpo added to the tally in what was a masterclass performance from Jürgen Klopp's side.</p>
        
        <h3>Key Statistics</h3>
        <ul>
          <li>Manchester United completed 89% of their passes in the second half</li>
          <li>Liverpool had 68% possession against Chelsea</li>
          <li>Arsenal created 15 chances but only converted 2</li>
        </ul>
        
        <h3>Looking Ahead</h3>
        <p>These results have significant implications for the title race, with Liverpool maintaining their position at the top while Manchester United climb to fourth place.</p>
      `,
      publishedAt: "2024-01-15",
      readTime: "5 min read",
      category: "Premier League",
      tags: ["Premier League", "Manchester United", "Liverpool", "Arsenal", "Chelsea"],
    },
    "champions-league-analysis": {
      id: 2,
      title: "Champions League Quarter-Finals: Tactical Analysis",
      content: `
        <h2>Tactical Masterclass</h2>
        <p>Breaking down the tactical masterclasses from this week's Champions League matches, highlighting key strategic decisions that shaped the outcomes.</p>
        
        <h3>Bayern Munich vs Real Madrid</h3>
        <p>Bayern's high pressing game proved effective against Real Madrid's possession-based approach. The German side's intensity in the first 30 minutes set the tone for their 2-1 victory.</p>
        
        <h3>Manchester City vs Barcelona</h3>
        <p>Pep Guardiola's tactical adjustments in the second half were crucial as City overturned a 1-0 deficit to win 3-1. The introduction of fresh legs in midfield changed the game's dynamics.</p>
        
        <h3>Key Tactical Insights</h3>
        <ul>
          <li>High pressing effectiveness increased by 34% in the final third</li>
          <li>Counter-attacking moves resulted in 60% of all goals scored</li>
          <li>Set pieces accounted for 40% of total goals</li>
        </ul>
      `,
      publishedAt: "2024-01-14",
      readTime: "4 min read",
      category: "Champions League",
      tags: ["Champions League", "Tactics", "Bayern Munich", "Real Madrid", "Manchester City", "Barcelona"],
    },
  }

  return articles[slug] || null
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const article = getArticleBySlug(params.slug)

  if (!article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">FlacronSport Daily</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-700 hover:text-blue-600">
                Live Scores
              </Link>
              <Link href="/blog" className="text-blue-600 font-medium">
                News
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href="/blog" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to News
            </Link>
          </Button>
        </div>

        {/* Article */}
        <Card className="overflow-hidden">
          <CardContent className="p-8">
            {/* Article header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">{article.category}</Badge>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{article.title}</h1>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {article.publishedAt}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {article.readTime}
                </span>
              </div>
            </div>

            {/* Article content */}
            <div className="prose max-w-none mb-8" dangerouslySetInnerHTML={{ __html: article.content }} />

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6 pt-6 border-t">
              {article.tags.map((tag: string) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Share buttons */}
            <div className="flex items-center gap-4 pt-6 border-t">
              <span className="text-sm font-medium text-gray-700">Share this article:</span>
              <Button variant="outline" size="sm">
                Twitter
              </Button>
              <Button variant="outline" size="sm">
                Facebook
              </Button>
              <Button variant="outline" size="sm">
                LinkedIn
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
