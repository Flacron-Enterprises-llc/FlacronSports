import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { PremiumProvider } from '@/lib/contexts/PremiumContext'
import Footer from "@/components/Footer";
import AdScript from "@/components/AdScript";
import ConditionalServiceWorker from "@/components/ConditionalServiceWorker";
import AggressiveAdBlocker from "@/components/AggressiveAdBlocker";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FlacronSport Daily',
  description: 'Your daily dose of sports news and analysis',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Removed Google AdSense Script from global layout */}
      </head>
      <body className={inter.className}>
        <PremiumProvider>
          <ConditionalServiceWorker />
          <AggressiveAdBlocker />
          <AdScript />
          {children}
          <Toaster />
        </PremiumProvider>
        <Footer />
        {/* API-Football Widget Script */}
        <script
          type="module"
          src="https://widgets.api-sports.io/2.0.3/widgets.js"
        ></script>
      </body>
    </html>
  )
}
