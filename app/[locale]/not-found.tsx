"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Compass } from "lucide-react"
import { authButton } from "@/components/auth/auth-ui"
import { Logo } from "@/components/site/brand"
import { IconBadge, StatusCard } from "@/components/site/status-card"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { useLocale } from "@/lib/use-locale"

export default function NotFound() {
  const { t, href } = useLocale()

  // The not-found render can replace <html>, which drops the theme set before paint.
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem("fs-theme") || localStorage.getItem("fs-theme")
    } catch {
      /* storage unavailable */
    }
    document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }, [])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_65%)]" />
      <header className="relative flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Logo href={href("/")} />
        <ThemeToggle className="size-11" />
      </header>
      <main id="main" className="relative flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <StatusCard visual={<IconBadge icon={Compass} tone="hot" />} title={t.common.notFound} body={t.common.notFoundBody}>
          <Link href={href("/")} className={authButton.primary}>{t.common.home}</Link>
          <Link href={href("/app")} className={authButton.outline}>{t.nav.openDashboard}</Link>
        </StatusCard>
      </main>
    </div>
  )
}
