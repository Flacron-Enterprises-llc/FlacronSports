"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Home, Newspaper, PlayCircle, Star, Trophy } from "lucide-react"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { localePath } from "@/lib/i18n"
import { useLocale } from "@/lib/use-locale"
import { Logo } from "./brand"
import { ThemeToggle } from "./theme-toggle"

function stripLocale(path: string): string {
  return path.replace(/^\/fr(?=\/|$)/, "") || "/"
}

export function SiteHeader() {
  const { locale, t, href } = useLocale()
  const path = stripLocale(usePathname() ?? "/")
  const user = useAuthUser()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const links = [
    ["/scores", t.nav.scores],
    ["/watch", t.nav.watch],
    ["/news", t.nav.news],
    ["/my-teams", t.nav.myTeams],
    ["/assistant", t.nav.assistant],
    ["/pricing", t.nav.pricing],
  ] as const

  return (
    <header className={`sticky top-0 z-40 border-b transition-colors duration-300 print:hidden ${scrolled ? "fs-glass border-line" : "border-transparent bg-bg"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo href={href("/")} />
        <nav aria-label={t.nav.primary} className="hidden items-center gap-1 lg:flex">
          {links.map(([to, label]) => {
            const active = path === to || path.startsWith(`${to}/`)
            return (
              <Link
                key={to}
                data-tour={to}
                href={href(to)}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-ink ${active ? "text-ink" : "text-ink-2"}`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-1">
          <Link href={localePath(locale === "en" ? "fr" : "en", path)} hrefLang={locale === "en" ? "fr" : "en"} className="rounded-md px-2 py-2 text-sm font-medium text-ink-2 hover:text-ink">
            {t.nav.language}
          </Link>
          <ThemeToggle />
          {user ? (
            <>
              <Link href={href("/notifications")} aria-label={t.notifications.title} className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:text-ink">
                <Bell aria-hidden className="size-5" />
              </Link>
              <Link data-tour="account" href={href("/dashboard")} className="ml-1 rounded-md bg-navy px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-deep">
                {t.nav.account}
              </Link>
            </>
          ) : (
            <>
              <Link href={href("/signin")} className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:block">
                {t.nav.signIn}
              </Link>
              <Link href={href("/signup")} className="ml-1 rounded-md bg-orange px-3.5 py-2 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover">
                {t.nav.getStarted}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function MobileTabs() {
  const { t, href } = useLocale()
  const path = stripLocale(usePathname() ?? "/")
  const tabs = [
    ["/", t.nav.home, Home],
    ["/scores", t.nav.scores, Trophy],
    ["/watch", t.nav.watch, PlayCircle],
    ["/news", t.nav.news, Newspaper],
    ["/my-teams", t.nav.myTeams, Star],
  ] as const

  return (
    <nav aria-label={t.nav.menu} className="fs-glass fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(([to, label, Icon]) => {
          const active = to === "/" ? path === "/" : path.startsWith(to)
          return (
            <li key={to}>
              <Link data-tour={to} href={href(to)} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-hot-text" : "text-ink-2"}`}>
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
