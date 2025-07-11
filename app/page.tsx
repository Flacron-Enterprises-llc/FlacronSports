import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, TrendingUp, Star } from "lucide-react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
// import AuthPopup from '@/components/auth/AuthPopup' - Removed to fix build error
// import { HealthStatus } from 

export default function HomePage() {
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />
      {/* <AuthPopup open={false} onClose={() => {}} /> - Removed to fix build error */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Live Sports Scores & Analysis</h2>
          <p className="text-xl text-gray-600 mb-8">Get real-time scores and match analysis</p>
          <p className="text-lg text-[var(--color-gray-dark)] mb-8 max-w-2xl mx-auto">FlacronSport brings you the latest live scores, in-depth match analysis, and AI-powered sports news from around the world. Stay ahead with real-time updates and expert insights for every fan.</p>
        </div>

        {/* Widgets Iframe */}
        <div className="mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 text-left">
              <h3 className="text-2xl font-bold text-[var(--color-black)] mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-6 bg-[var(--color-primary)] rounded-full mr-2"></span>
                Live Match Center
              </h3>
              <p className="text-md text-[var(--color-gray-dark)] mb-4">Track live scores, stats, and match events in real time. Powered by FlacronSport.</p>
            </div>
            <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-white)] shadow-lg overflow-hidden">
              <iframe
                src="/widgets.html"
                title="Live Sports Widgets"
                style={{
                  width: '100%',
                  minHeight: '750px',
                  border: 'none',
                  background: 'transparent',
                  display: 'block',
                }}
                allowFullScreen
              />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar removed as requested */}
        </div>
        
        {/* Additional Content Sections */}
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-blue-600" />
                Live Sports Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Get real-time updates from major leagues including NFL, NBA, Premier League, Champions League, and more. Our AI-powered system delivers instant notifications and detailed match analysis.
              </p>
            </CardContent>
          </Card>
          
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                AI-Powered Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Our advanced AI analyzes player statistics, team performance, and historical data to provide intelligent insights and predictions for upcoming matches.
              </p>
            </CardContent>
          </Card>
          
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-600" />
                Premium Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Unlock exclusive content with premium features including early access to articles, ad-free browsing, and personalized sports newsletters.
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* How It Works Section */}
        <div className="mt-16 bg-white rounded-2xl p-8 shadow-lg">
          <h3 className="text-2xl font-bold text-center mb-8">How FlacronSport Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">Data Collection</h4>
              <p className="text-gray-600">We gather real-time sports data from multiple reliable sources across various leagues and tournaments worldwide.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">AI Analysis</h4>
              <p className="text-gray-600">Our AI processes the data to create insightful summaries, statistics, and predictions for each match and player.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-yellow-600">3</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">Content Delivery</h4>
              <p className="text-gray-600">You receive personalized sports content, live updates, and expert analysis delivered in real-time.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
