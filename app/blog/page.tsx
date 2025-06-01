import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Search, Filter, Trophy } from "lucide-react"
import Link from "next/link"

export default function BlogPage() {
  // Mock articles data
  const articles = [
    {
      id: 1,
      title: "Premier League Weekend Roundup: Stunning Upsets and Record-Breaking Performances",
      excerpt:
        "This weekend's Premier League action delivered incredible drama with Manchester United's comeback victory and Liverpool's dominant display against Chelsea.",
      publishedAt: "2024-01-15",
      readTime: "5 min read",
      category: "Premier League",
      featured: true,
      slug: "premier-league-weekend-roundup",
    },
    {
      id: 2,
      title: "Champions League Quarter-Finals: Tactical Analysis",
      excerpt:
        "Breaking down the tactical masterclasses from this week's Champions League matches, highlighting key strategic decisions.",
      publishedAt: "2024-01-14",
      readTime: "4 min read",
      category: "Champions League",
      featured: false,
      slug: "champions-league-analysis",
    },
    {
      id: 3,
      title: "La Liga Title Race: Barcelona vs Real Madrid",
      excerpt:
        "A comprehensive statistical analysis of the ongoing La Liga title race, featuring performance metrics and insights.",
      publishedAt: "2024-01-13",
      readTime: "6 min read",
      category: "La Liga",
      featured: false,
      slug: "la-liga-title-race",
    },
    {
      id: 4,
      title: "Transfer Window Analysis: January Moves",
      excerpt: "Analyzing the most significant transfer moves this January window across Europe's top leagues.",
      publishedAt: "2024-01-12",
      readTime: "7 min read",
      category: "Transfers",
      featured: false,
      slug: "transfer-window-analysis",
    },
  ]

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Sports News & Analysis</h1>
          <p className="text-gray-600">Latest sports articles and match analysis</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="Search articles..." className="pl-10" />
          </div>
          <Select>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by league" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              <SelectItem value="premier-league">Premier League</SelectItem>
              <SelectItem value="champions-league">Champions League</SelectItem>
              <SelectItem value="la-liga">La Liga</SelectItem>
              <SelectItem value="bundesliga">Bundesliga</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Featured Article */}
        {articles
          .filter((article) => article.featured)
          .map((article) => (
            <Card key={article.id} className="mb-8 overflow-hidden">
              <div className="md:flex">
                <div className="md:w-1/3 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white flex items-center justify-center">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">Featured Article</h3>
                    <p className="text-blue-100">Latest Analysis</p>
                  </div>
                </div>
                <div className="md:w-2/3 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">{article.category}</Badge>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">{article.title}</h2>
                  <p className="text-gray-600 mb-4">{article.excerpt}</p>
                  <div className="flex items-center justify-between">
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
                    <Button asChild>
                      <Link href={`/blog/${article.slug}`}>Read Full Article</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles
            .filter((article) => !article.featured)
            .map((article) => (
              <Card key={article.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{article.category}</Badge>
                  </div>
                  <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">{article.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {article.publishedAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/blog/${article.slug}`}>Read Article</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg">
            Load More Articles
          </Button>
        </div>
      </main>
    </div>
  )
}
