import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, TrendingUp, Star } from "lucide-react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import AuthPopup from '@/components/auth/AuthPopup'
// import { HealthStatus } from 

export default function HomePage() {
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />
      <AuthPopup />
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
      </main>
      <footer className="mt-16 py-8 border-t border-[var(--color-border)] bg-[var(--color-black)] text-[var(--color-white)] text-center rounded-t-2xl shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3 justify-center">
            <img src="/logo.png" alt="FlacronSport Logo" width={40} height={40} className="rounded" />
            <span className="font-bold text-xl tracking-wide">FlacronSport</span>
          </div>
          <div className="text-sm text-[var(--color-gray-mid)]">&copy; {new Date().getFullYear()} FlacronSport. All rights reserved.</div>
          <div className="flex gap-4 justify-center">
            <a href="/" className="hover:text-[var(--color-primary)] transition-colors">Home</a>
            <a href="/blog" className="hover:text-[var(--color-primary)] transition-colors">Blog</a>
            <a href="mailto:contact@flacronsport.com" className="hover:text-[var(--color-primary)] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
