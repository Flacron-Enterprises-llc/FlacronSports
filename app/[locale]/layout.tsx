import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { notFound } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { CookieConsent } from "@/components/consent/consent-ui"
import { isLocale, LOCALES } from "@/lib/i18n"
import "../globals.css"

const sora = localFont({ src: "../../fonts/Sora-Variable.ttf", variable: "--font-sora", weight: "100 800", display: "swap" })
const inter = localFont({ src: "../../fonts/Inter-Variable.ttf", variable: "--font-inter", weight: "100 900", display: "swap" })

const SITE_URL = process.env.APP_BASE_URL || "https://flacronsport.com"
const DESCRIPTION = "Multi-sport scores, fixtures, authorized viewing options and match coverage, with your teams first."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "FlacronSport", template: "%s · FlacronSport" },
  description: DESCRIPTION,
  applicationName: "FlacronSport",
  icons: { icon: "/brand/favicon-48.png", apple: "/brand/apple-touch-icon.png" },
  openGraph: { type: "website", siteName: "FlacronSport", title: "FlacronSport", description: DESCRIPTION, images: ["/brand/fs-logo-full.png"] },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050d1c" },
  ],
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

/** Applies the saved or system theme before first paint. */
const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('fs-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t}catch(e){}})()`

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning className={`${sora.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link">Skip to content</a>
        <ConsentProvider>
          {children}
          <CookieConsent />
          <Toaster />
        </ConsentProvider>
      </body>
    </html>
  )
}
