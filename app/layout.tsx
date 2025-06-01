import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* API-Football Widget Script */}
        <script
          type="module"
          src="https://widgets.api-sports.io/2.0.3/widgets.js"
        ></script>
      </body>
    </html>
  )
}
