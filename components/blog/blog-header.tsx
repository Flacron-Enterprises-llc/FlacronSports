import Link from "next/link"
import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"

export function BlogHeader() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <Trophy className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">FlacronSport Daily</span>
          </Link>
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-blue-600">
              Live Scores
            </Link>
            <Link href="/blog" className="text-blue-600 font-medium">
              News
            </Link>
            <Link href="/subscription" className="text-gray-700 hover:text-blue-600">
              Premium
            </Link>
          </nav>
          <Button asChild>
            <Link href="/subscription">Subscribe</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
