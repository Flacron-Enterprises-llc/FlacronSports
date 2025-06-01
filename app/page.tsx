import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, TrendingUp, Star } from "lucide-react"
import Link from "next/link"
import { HealthStatus } from "@/components/health-status"

export default function HomePage() {
  const recentArticles = [
    {
      id: 1,
      title: "Premier League Weekend Roundup",
      excerpt: "Manchester United's comeback victory and Liverpool's dominant display highlight an exciting weekend.",
      publishedAt: "2 hours ago",
      readTime: "3 min read",
    },
    {
      id: 2,
      title: "Champions League Quarter-Finals Preview",
      excerpt: "Analyzing the tactical battles ahead in this week's Champions League matches.",
      publishedAt: "5 hours ago",
      readTime: "4 min read",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">FlacronSport Daily</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-blue-600 font-medium">
                Live Scores
              </Link>
              <Link href="/blog" className="text-gray-700 hover:text-blue-600">
                News
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Live Sports Scores & Analysis</h2>
          <p className="text-xl text-gray-600 mb-8">Get real-time scores and match analysis powered by API-Sports</p>
        </div>

        {/* Widgets Iframe */}
        <div className="flex justify-center mb-12">
          <iframe
            src="/widgets.html"
            title="Live Sports Widgets"
            style={{
              width: '100%',
              maxWidth: '1100px',
              minHeight: '750px',
              border: 'none',
              borderRadius: '16px',
              boxShadow: '0 0 16px rgba(0,0,0,0.08)',
              background: 'transparent',
            }}
            allowFullScreen
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="space-y-6 lg:col-start-3">
            {/* System Health Status */}
            <HealthStatus />

            {/* Recent Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Latest Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentArticles.map((article) => (
                  <div key={article.id} className="border-b pb-4 last:border-b-0">
                    <h3 className="font-semibold text-sm mb-2 hover:text-blue-600 cursor-pointer">{article.title}</h3>
                    <p className="text-xs text-gray-600 mb-2">{article.excerpt}</p>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{article.publishedAt}</span>
                      <span>{article.readTime}</span>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/blog">Read More Articles</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Features */}
            <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-blue-100">
                  <li>• Live scores from multiple sports</li>
                  <li>• Football and Baseball coverage</li>
                  <li>• Real-time updates every 15 seconds</li>
                  <li>• Interactive standings and game modals</li>
                  <li>• Powered by API-Sports</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
