"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { localePath } from "@/lib/i18n"
import { FEATURES } from "@/lib/marketing"
import { useLocale } from "@/lib/use-locale"
import { Logo } from "./brand"
import { FeatureIcon } from "./feature-icon"
import { buttonClass } from "./marketing/button"
import { useScrollProgress } from "./motion"
import { ThemeToggle } from "./theme-toggle"

function stripLocale(path: string): string {
  return path.replace(/^\/(?:fr|en)(?=\/|$)/, "") || "/"
}

function navLink(active: boolean) {
  return `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    active ? "text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-hot" : "text-ink-2 hover:text-ink"
  }`
}

export function SiteHeader() {
  const { locale, t, href } = useLocale()
  const path = stripLocale(usePathname() ?? "/")
  const user = useAuthUser()
  const progress = useScrollProgress()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMenu(false)
    setOpen(false)
  }, [path])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!menu && !open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (menu) menuButton.current?.focus()
      else panelButton.current?.focus()
      setMenu(false)
      setOpen(false)
    }
    const onDown = (event: MouseEvent) => {
      if (menu && !menuRef.current?.contains(event.target as Node)) setMenu(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    if (open) panel.current?.querySelector<HTMLElement>("a")?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [menu, open])

  const isActive = (to: string) => path === to || path.startsWith(`${to}/`)
  const otherLocale = locale === "en" ? "fr" : "en"
  const links = [
    ["/sports", t.nav.sports],
    ["/pricing", t.nav.pricing],
    ["/faq", t.nav.faq],
  ] as const

  return (
    <header className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 print:hidden ${scrolled || open ? "fs-glass border-line shadow-[0_8px_24px_-18px_rgb(10_26_51/0.35)]" : "border-transparent bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo href={href("/")} />
        <nav aria-label={t.nav.primary} className="hidden items-center gap-0.5 lg:flex">
          <div
            ref={menuRef}
            className="relative"
            onBlur={(event) => {
              if (menu && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setMenu(false)
            }}
          >
            <button
              ref={menuButton}
              type="button"
              aria-expanded={menu}
              aria-controls="features-menu"
              onClick={() => setMenu((value) => !value)}
              className={`${navLink(isActive("/features"))} inline-flex items-center gap-1`}
            >
              {t.nav.features} <ChevronDown aria-hidden className={`size-3.5 transition-transform duration-200 ${menu ? "rotate-180" : ""}`} />
            </button>
            {menu && (
              <div id="features-menu" className="fs-pop absolute left-0 top-full mt-3 w-[640px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-lg)]">
                <ul className="grid grid-cols-2 p-3">
                  {FEATURES.map((feature) => (
                    <li key={feature.slug}>
                      <Link href={href(`/features/${feature.slug}`)} className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-muted">
                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-brand transition-colors group-hover:text-hot-text">
                          <FeatureIcon k={feature.icon} className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink">
                            {feature[locale].name}
                            {feature.comingSoon && <span className="text-[11px] font-semibold text-hot-text">{t.nav.soon}</span>}
                          </span>
                          <span className="block text-xs leading-5 text-ink-3">{feature[locale].blurb}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line bg-surface-muted p-3">
                  <Link href={href("/features")} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-hot-text hover:bg-surface">
                    {t.nav.allFeatures} <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
          {links.map(([to, label]) => (
            <Link key={to} href={href(to)} aria-current={isActive(to) ? "page" : undefined} className={navLink(isActive(to))}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href={localePath(otherLocale, path)} hrefLang={otherLocale} className="hidden rounded-lg px-2 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:inline-flex">
            {t.nav.language}
          </Link>
          <ThemeToggle />
          {user ? (
            <Link href={href("/app")} className={buttonClass("primary", "md", "max-sm:hidden")}>{t.nav.openDashboard}</Link>
          ) : (
            <>
              <Link href={href("/signin")} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:inline-flex">{t.nav.signIn}</Link>
              <Link href={href("/signup")} className={buttonClass("primary", "md", "max-sm:hidden")}>{t.nav.getStarted}</Link>
            </>
          )}
          <button
            ref={panelButton}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.nav.close : t.nav.openMenu}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-surface-muted lg:hidden"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" ref={panel} className="fs-fade max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-surface px-4 pb-6 pt-2 lg:hidden">
          <nav aria-label={t.nav.menu} className="flex flex-col">
            {links.map(([to, label]) => (
              <Link key={to} href={href(to)} aria-current={isActive(to) ? "page" : undefined} className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-surface-muted">
                {label}
              </Link>
            ))}
            <Link href={localePath(otherLocale, path)} hrefLang={otherLocale} className="rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-surface-muted">
              {t.nav.language}
            </Link>
            <p className="mt-3 px-3 text-xs font-semibold text-ink-3">{t.nav.features}</p>
            <div className="mt-1 grid gap-1 min-[420px]:grid-cols-2">
              {FEATURES.map((feature) => (
                <Link key={feature.slug} href={href(`/features/${feature.slug}`)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-2 hover:bg-surface-muted hover:text-ink">
                  <FeatureIcon k={feature.icon} className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0">{feature[locale].name}</span>
                </Link>
              ))}
              <Link href={href("/features")} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-hot-text hover:bg-surface-muted">
                {t.nav.allFeatures} <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <div className="mt-5 grid gap-2 border-t border-line pt-5">
              {user ? (
                <Link href={href("/app")} className={buttonClass("primary", "lg", "w-full")}>{t.nav.openDashboard}</Link>
              ) : (
                <>
                  <Link href={href("/signup")} className={buttonClass("primary", "lg", "w-full")}>{t.nav.getStarted}</Link>
                  <Link href={href("/signin")} className={buttonClass("outline", "lg", "w-full")}>{t.nav.signIn}</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden">
        <div className="fs-progress h-full bg-gradient-to-r from-[var(--fs-orange)] via-[#ff7a3d] to-[var(--fs-blue)]" style={{ ["--p" as string]: progress }} />
      </div>
    </header>
  )
}
