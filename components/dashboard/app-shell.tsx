"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell, CreditCard, Home, LayoutDashboard, LogOut, Menu, MessageCircleQuestion, Newspaper, PlayCircle, Settings, Shield, Star, Trophy, Users, X,
} from "lucide-react"
import { Logo } from "@/components/site/brand"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { AppTour } from "@/components/tour/app-tour"
import { authFetch } from "@/lib/auth-fetch"
import { PLANS, type PlanId } from "@/lib/billing/plans"
import { signOutUser } from "@/lib/firebase-auth"
import { useAuthState } from "@/lib/hooks/useAuthUser"
import { localePath } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"
import { useLocale } from "@/lib/use-locale"

const TEST_BILLING = process.env.NEXT_PUBLIC_BILLING_MODE !== "live"
const COMMUNITY = process.env.NEXT_PUBLIC_COMMUNITY_ENABLED === "true"

function stripLocale(path: string): string {
  return path.replace(/^\/fr(?=\/|$)/, "") || "/"
}

interface Usage {
  remaining: number
  included: { limit: number }
}

function useNav(role: string | null) {
  const { t } = useLocale()
  return useMemo(() => {
    const groups = [
      {
        title: t.dash.today,
        items: [
          { to: "/app", label: t.dash.dashboard, icon: LayoutDashboard },
          { to: "/app/scores", label: t.nav.scores, icon: Trophy },
          { to: "/app/watch", label: t.nav.watch, icon: PlayCircle },
          { to: "/app/news", label: t.nav.news, icon: Newspaper },
        ],
      },
      {
        title: t.dash.follow,
        items: [
          { to: "/app/my-teams", label: t.nav.myTeams, icon: Star },
          { to: "/app/notifications", label: t.dash.notifications, icon: Bell },
        ],
      },
      {
        title: t.dash.tools,
        items: [
          { to: "/app/assistant", label: t.nav.assistant, icon: MessageCircleQuestion },
          ...(COMMUNITY ? [{ to: "/app/rooms", label: t.dash.rooms, icon: Users }] : []),
        ],
      },
      {
        title: t.dash.account,
        items: [
          { to: "/app/billing", label: t.dash.billing, icon: CreditCard },
          { to: "/app/settings", label: t.dash.settings, icon: Settings },
        ],
      },
    ]
    if (role) groups.push({ title: t.dash.staff, items: [{ to: "/app/admin", label: t.dash.admin, icon: Shield }] })
    return groups
  }, [t, role])
}

function Sidebar({ path, role, email, plan, usage, onNavigate }: { path: string; role: string | null; email: string | null; plan: PlanId; usage: Usage | null; onNavigate?: () => void }) {
  const { t, href } = useLocale()
  const router = useRouter()
  const groups = useNav(role)
  const used = usage ? Math.max(0, usage.included.limit - usage.remaining) : 0
  const percent = usage && usage.included.limit > 0 ? Math.min(100, Math.round((used / usage.included.limit) * 100)) : 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-4"><Logo href={href("/app")} /></div>
      <nav aria-label={t.nav.primary} className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 text-xs font-semibold text-ink-3">{group.title}</p>
            <ul className="mt-1 space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => {
                const active = to === "/app" ? path === "/app" : path === to || path.startsWith(`${to}/`)
                return (
                  <li key={to}>
                    <Link
                      data-tour={to}
                      href={href(to)}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-surface-muted text-ink" : "text-ink-2 hover:bg-surface-muted hover:text-ink"}`}
                    >
                      <Icon aria-hidden className={`size-[18px] ${active ? "text-hot-text" : ""}`} />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="rounded-xl bg-surface-muted p-3">
          <p className="truncate text-sm font-medium text-ink">{email}</p>
          <p className="mt-0.5 text-xs text-ink-2">{PLANS[plan].name} {t.dash.planLabel}</p>
          {usage && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t.dash.requests}>
                <div className="h-full rounded-full bg-orange" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-2">{usage.remaining} {t.dash.requests}</p>
            </div>
          )}
          {plan === "free" && <Link href={href("/pricing")} onClick={onNavigate} className="mt-2 inline-block text-xs font-semibold text-hot-text underline-offset-2 hover:underline">{t.dash.upgrade}</Link>}
        </div>
        <button type="button" onClick={() => signOutUser().then(() => router.push(href("/")))} className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-muted hover:text-ink">
          <LogOut aria-hidden className="size-[18px]" /> {t.dash.signOut}
        </button>
      </div>
    </div>
  )
}

function MobileTabs({ path }: { path: string }) {
  const { t, href } = useLocale()
  const tabs = [
    ["/app", t.nav.home, Home],
    ["/app/scores", t.nav.scores, Trophy],
    ["/app/watch", t.nav.watch, PlayCircle],
    ["/app/news", t.nav.news, Newspaper],
    ["/app/my-teams", t.nav.myTeams, Star],
  ] as const
  return (
    <nav aria-label={t.nav.menu} className="fs-glass fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(([to, label, Icon]) => {
          const active = to === "/app" ? path === "/app" : path.startsWith(to)
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

/** Every product route needs a signed-in, verified account. Plans are enforced by the API. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const full = usePathname() ?? "/app"
  const path = stripLocale(full)
  const { user, ready } = useAuthState()
  const [drawer, setDrawer] = useState(false)
  const [plan, setPlan] = useState<PlanId>("free")
  const [usage, setUsage] = useState<Usage | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!user) router.replace(href(`/signin?next=${encodeURIComponent(path)}`))
    else if (!user.emailVerified) router.replace(href("/verify-email"))
  }, [ready, user, router, href, path])

  useEffect(() => {
    if (!user?.emailVerified) return
    authFetch("/api/billing/status").then((r) => (r.ok ? r.json() : null)).then((d) => d?.plan && setPlan(d.plan)).catch(() => undefined)
    authFetch("/api/assistant").then((r) => (r.ok ? r.json() : null)).then((d) => d?.balance && setUsage(d.balance)).catch(() => undefined)
    user.getIdTokenResult().then((r) => setRole(typeof r.claims.role === "string" ? r.claims.role : null)).catch(() => undefined)
  }, [user])

  useEffect(() => setDrawer(false), [path])

  if (!ready || !user?.emailVerified) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <p className="text-sm text-ink-2">{t.dash.loading}</p>
      </div>
    )
  }

  const shared = { path, role, email: user.email, plan, usage }

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block print:hidden">
        <Sidebar {...shared} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={t.dash.closeMenu} onClick={() => setDrawer(false)} className="absolute inset-0 bg-[#001a3f]/40" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-[var(--shadow-lg)]">
            <button type="button" aria-label={t.dash.closeMenu} onClick={() => setDrawer(false)} className="absolute right-2 top-3 inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-muted">
              <X aria-hidden className="size-5" />
            </button>
            <Sidebar {...shared} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="fs-glass sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-line px-4 sm:px-6 print:hidden">
        <div className="flex items-center gap-2">
          <button type="button" aria-label={t.dash.openMenu} aria-expanded={drawer} onClick={() => setDrawer(true)} className="inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-muted lg:hidden">
            <Menu aria-hidden className="size-5" />
          </button>
          <span className="lg:hidden"><Logo href={href("/app")} /></span>
          {TEST_BILLING && <span className="hidden rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-warn sm:inline-block">{t.dash.testMode}</span>}
        </div>
        <div className="flex items-center gap-1">
          <Link href={localePath(locale === "en" ? "fr" : "en", path)} hrefLang={locale === "en" ? "fr" : "en"} className="rounded-md px-2 py-2 text-sm font-medium text-ink-2 hover:text-ink">{t.nav.language}</Link>
          <ThemeToggle />
          <Link href={href("/app/notifications")} aria-label={t.dash.notifications} className="inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-muted hover:text-ink">
            <Bell aria-hidden className="size-[18px]" />
          </Link>
        </div>
      </header>

      <div id="main-area" className="pb-20 lg:pb-8">{children}</div>

      <footer className="hidden px-6 pb-6 text-xs text-ink-3 lg:block print:hidden">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {POLICIES.map((policy) => <li key={policy.slug}><Link className="hover:text-ink" href={href(`/${policy.slug}`)}>{policy.label}</Link></li>)}
        </ul>
      </footer>

      <MobileTabs path={path} />
      <AppTour />
    </div>
  )
}
