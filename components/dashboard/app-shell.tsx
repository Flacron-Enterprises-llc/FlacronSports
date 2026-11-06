"use client"

import { HouseAd } from "./house-ad"
import { PaywallGate } from "./paywall"
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Bookmark, ChevronDown, ChevronRight, Compass, CreditCard, Home, LayoutDashboard, LayoutGrid, LogOut, Medal, Menu, GitCompareArrows, MessageCircleQuestion, Newspaper, PlayCircle, Search, Settings, Shield, ShieldCheck, Sparkles, Star, Trophy, Users, X,
  Flag,
} from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { CookiePreferencesButton } from "@/components/consent/consent-ui"
import { Logo } from "@/components/site/brand"
import { RevealObserver } from "@/components/site/motion"
import { SportIcon } from "@/components/site/sport-icon"
import { Meter, Skeleton } from "@/components/site/states"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { AppTour, startTour } from "@/components/tour/app-tour"
import { PLANS } from "@/lib/billing/plans"
import { signOutUser } from "@/lib/firebase-auth"
import { useAuthState } from "@/lib/hooks/useAuthUser"
import { localePath } from "@/lib/i18n"
import { POLICIES } from "@/lib/legal/content"
import { sportSwitchPath } from "@/lib/sports/sport-link"
import { SPORTS } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { AccountProvider, useAccount } from "./account-context"
import { OfflineBanner, useFocusTrap, usePopover } from "./controls"
import { BootLoader, NavProgress, useExit } from "./loading"
import { NotificationBell } from "./notification-bell"

function stripLocale(path: string): string {
  return path.replace(/^\/fr(?=\/|$)/, "") || "/"
}

const isCurrent = (to: string, path: string) => (to === "/app" ? path === "/app" : path === to || path.startsWith(`${to}/`))

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const parts = (name || email || "?").trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function useNav() {
  const { t } = useLocale()
  const { role, community } = useAccount()
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
          { to: "/app/board", label: t.discover.boardNav, icon: LayoutGrid },
          { to: "/app/news/saved", label: t.discover.saved, icon: Bookmark },
        ],
      },
      {
        title: t.dash.tools,
        items: [
          { to: "/app/assistant", label: t.nav.assistant, icon: MessageCircleQuestion },
          { to: "/app/compare", label: t.compare.title, icon: GitCompareArrows },
          ...(community ? [{ to: "/app/rooms", label: t.dash.rooms, icon: Users }, { to: "/app/predictions", label: t.dash.predictions, icon: Medal }, { to: "/app/clubs", label: t.community.clubsTitle, icon: Flag }] : []),
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
  }, [t, role, community])
}

function Sidebar({ path, onClose }: { path: string; onClose?: () => void }) {
  const { t, href } = useLocale()
  const { user, plan, balance, dayPassEnd, loaded } = useAccount()
  const groups = useNav()
  const name = user?.displayName ?? null
  const email = user?.email ?? null
  const included = balance?.included

  return (
    <div className="fs-side relative flex h-full w-full flex-col overflow-hidden border-r border-[var(--sidebar-line)]">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Logo reversed href={href("/app")} />
        {onClose && (
          <button type="button" aria-label={t.dash.closeMenu} onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label={t.nav.primary} className="fs-noscrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="mt-4 first:mt-1">
            <p className="fs-side-label px-3 pb-1.5 text-[11px] font-semibold">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link data-tour={to} href={href(to)} onClick={onClose} aria-current={isCurrent(to, path) ? "page" : undefined} className="fs-side-link relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150">
                    <Icon aria-hidden className="size-[17px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--sidebar-line)] p-3">
        <div className="fs-side-card rounded-xl p-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e5bb8] to-[#002961] font-display text-[13px] font-semibold text-white">{initials(name, email)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{name ?? email}</p>
              {loaded ? (
                <p className="text-[11px] text-[var(--sidebar-ink)]">{plan === "none" ? t.paywall.noPlan : `${PLANS[plan].name} ${t.dash.planLabel}`}{dayPassEnd ? ` · ${t.ui.dayPassShort}` : ""}</p>
              ) : (
                <Skeleton className="mt-1 h-3 w-16 opacity-20" />
              )}
            </div>
          </div>
          {included && (
            <div className="mt-3">
              <div className="flex justify-between gap-2 text-[11px] text-[var(--sidebar-ink)]">
                <span className="min-w-0 truncate">{t.ui.assistantAllowance}</span>
                <span className="tabular text-white">{included.used}/{included.limit}</span>
              </div>
              <Meter value={included.used} max={included.limit} label={t.ui.assistantAllowance} tone="inverse" className="mt-1" />
            </div>
          )}
          {loaded && plan === "basic" && (
            <Link href={href("/app/billing#plans")} onClick={onClose} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-orange px-3 text-[13px] font-semibold text-hot-on transition-colors hover:bg-orange-hover">
              <Sparkles aria-hidden className="size-3.5" /> {t.dash.upgrade}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function Drawer({ open, onClose, path }: { open: boolean; onClose(): void; path: string }) {
  const { t } = useLocale()
  const mounted = useExit(open, 220)
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel, open, onClose)
  if (!mounted) return null
  const closing = open ? undefined : true
  return (
    <div className="fixed inset-0 z-50 lg:hidden print:hidden">
      <div aria-hidden data-closing={closing} onClick={onClose} className="fs-scrim absolute inset-0" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={t.nav.menu} data-closing={closing} className="fs-drawer absolute inset-y-0 left-0 flex w-[min(86vw,var(--sidebar-w))] shadow-[var(--shadow-lg)]">
        <Sidebar path={path} onClose={onClose} />
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
          const active = isCurrent(to, path)
          return (
            <li key={to}>
              <Link data-tour={to} href={href(to)} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[11px] font-medium leading-tight transition-colors", active ? "text-hot-text" : "text-ink-2")}>
                <span aria-hidden className={cn("absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-orange transition-transform duration-300 [transition-timing-function:var(--ease)]", active ? "scale-x-100" : "scale-x-0")} />
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

function Crumbs({ path }: { path: string }) {
  const { t, href } = useLocale()
  const roots: [string, string][] = [
    ["/app/scores", t.nav.scores], ["/app/watch", t.nav.watch], ["/app/news", t.nav.news], ["/app/my-teams", t.nav.myTeams], ["/app/notifications", t.dash.notifications], ["/app/search", t.discover.searchTitle], ["/app/board", t.discover.boardTitle],
    ["/app/assistant", t.nav.assistant], ["/app/compare", t.compare.title], ["/app/rooms", t.dash.rooms], ["/app/predictions", t.dash.predictions], ["/app/clubs", t.community.clubsTitle], ["/app/billing", t.dash.billing], ["/app/settings", t.dash.settings], ["/app/admin", t.dash.admin],
  ]
  const details: [RegExp, string, string, string][] = [
    [/^\/app\/match\//, "/app/scores", t.nav.scores, t.ui.matchCenter],
    [/^\/app\/team\//, "/app/scores", t.nav.scores, t.ui.teamPage],
    [/^\/app\/standings\//, "/app/scores", t.nav.scores, t.standings.title],
    [/^\/app\/player\//, "/app/search", t.discover.searchTitle, t.discover.players],
    [/^\/app\/news\/saved/, "/app/news", t.nav.news, t.discover.saved],
    [/^\/app\/news\/.+/, "/app/news", t.nav.news, t.reports.label],
    [/^\/app\/settings\/security/, "/app/settings", t.dash.settings, t.security.title],
    [/^\/app\/rooms\/join/, "/app/rooms", t.dash.rooms, t.community.join],
    [/^\/app\/predictions\/join/, "/app/predictions", t.dash.predictions, t.community.joinGroup],
    [/^\/app\/clubs\//, "/app/clubs", t.community.clubsTitle, t.community.clubChat],
    [/^\/app\/billing\/invite/, "/app/billing", t.dash.billing, t.community.inviteTitle],
  ]
  const detail = details.find(([pattern]) => pattern.test(path))
  const current = detail?.[3] ?? roots.find(([to]) => path === to)?.[1] ?? t.dash.dashboard
  return (
    <nav aria-label={t.ui.breadcrumb} className="hidden min-w-0 lg:block">
      <ol className="flex items-center gap-1.5 text-sm">
        {detail && (
          <li className="flex items-center gap-1.5">
            <Link href={href(detail[1])} className="text-ink-2 hover:text-ink">{detail[2]}</Link>
            <ChevronRight aria-hidden className="size-3.5 text-ink-3" />
          </li>
        )}
        <li aria-current="page" className="truncate font-display font-semibold text-ink">{current}</li>
      </ol>
    </nav>
  )
}

function TopSearch({ className }: { className?: string }) {
  const { t, href } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const id = useId()
  const sport = params?.get("sport")
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim()
    const query = new URLSearchParams({ ...(q ? { q } : {}), ...(sport ? { sport } : {}) }).toString()
    router.push(href(`/app/search${query ? `?${query}` : ""}`))
  }
  return (
    <form role="search" onSubmit={submit} className={cn("relative min-w-0", className)}>
      <label htmlFor={id} className="sr-only">{t.discover.searchLabel}</label>
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input key={params?.get("q") ?? ""} id={id} type="search" name="q" maxLength={80} defaultValue={params?.get("q") ?? ""} placeholder={t.discover.searchPlaceholder} className="fs-input h-9 w-full pl-8 pr-2 text-[13px]" />
    </form>
  )
}

function SportSwitcher({ path, className }: { path: string; className?: string }) {
  const { locale, t, href } = useLocale()
  const params = useSearchParams()
  const { open, setOpen, box, trigger } = usePopover()
  const linkTo = (sport: string | null) => href(sportSwitchPath(path, params?.toString() ?? "", sport))
  const current = SPORTS.find((sport) => sport.id === params?.get("sport"))
  const item = "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-muted hover:text-ink"
  return (
    <div ref={box} className={cn("relative", className)}>
      <button ref={trigger} type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex h-9 max-w-44 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
        {current && <SportIcon id={current.id} className="size-4" />}
        {current ? current.name[locale] : t.scores.allSports}
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="fs-pop fs-noscrollbar absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1.5 shadow-[var(--shadow-lg)]">
          <Link href={linkTo(null)} onClick={() => setOpen(false)} className={item}>{t.scores.allSports}</Link>
          {SPORTS.filter((sport) => sport.enabled).map((sport) => (
            <Link key={sport.id} href={linkTo(sport.id)} onClick={() => setOpen(false)} aria-current={current?.id === sport.id ? "true" : undefined} className={item}>
              <SportIcon id={sport.id} className="size-4 shrink-0" />{sport.name[locale]}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function LanguageSwitch({ path }: { path: string }) {
  const { locale, t } = useLocale()
  const params = useSearchParams()
  const { signedIn, update } = usePreferences()
  const other = locale === "en" ? "fr" : "en"
  const query = params?.toString()
  return (
    <Link
      href={`${localePath(other, path)}${query ? `?${query}` : ""}`}
      hrefLang={other}
      aria-label={t.nav.language}
      title={t.nav.language}
      onClick={() => { if (signedIn) void update({ locale: other }) }}
      className="inline-flex h-10 items-center rounded-lg px-2 text-[13px] font-semibold uppercase text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {other}
    </Link>
  )
}

function UserMenu() {
  const { t, href } = useLocale()
  const router = useRouter()
  const { user, plan } = useAccount()
  const { open, setOpen, box, trigger } = usePopover()
  const name = user?.displayName ?? null
  const email = user?.email ?? null
  const item = "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink"
  const close = () => setOpen(false)

  useEffect(() => {
    if (open) box.current?.querySelector<HTMLElement>("[data-menu] a")?.focus()
  }, [open, box])

  return (
    <div ref={box} className="relative">
      <button ref={trigger} type="button" aria-haspopup="true" aria-expanded={open} aria-label={t.ui.accountMenu} onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-surface-muted sm:pr-1.5">
        <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#002961] to-[#1e5bb8] font-display text-[13px] font-semibold text-white ring-2 ring-surface">{initials(name, email)}</span>
        <ChevronDown aria-hidden className={cn("hidden size-3.5 text-ink-3 transition-transform duration-200 sm:block", open && "rotate-180")} />
      </button>
      {open && (
        <div data-menu className="fs-pop absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-surface-raised p-1.5 shadow-[var(--shadow-lg)]">
          <div className="px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-ink">{name ?? t.nav.account}</p>
            <p className="truncate text-xs text-ink-2">{email}</p>
            <p className="mt-1 text-xs font-medium text-ink-2">{plan === "none" ? t.paywall.noPlan : `${PLANS[plan].name} ${t.dash.planLabel}`}</p>
          </div>
          <div className="border-t border-line py-1.5">
            <Link href={href("/app/settings")} onClick={close} className={item}><Settings aria-hidden className="size-4" />{t.dash.settings}</Link>
            <Link href={href("/app/settings/security")} onClick={close} className={item}><ShieldCheck aria-hidden className="size-4" />{t.security.title}</Link>
            <Link href={href("/app/billing")} onClick={close} className={item}><CreditCard aria-hidden className="size-4" />{t.dash.billing}</Link>
            <button type="button" onClick={() => { close(); startTour() }} className={item}><Compass aria-hidden className="size-4" />{t.tour.replay}</button>
            <CookiePreferencesButton className={item} />
          </div>
          <div className="border-t border-line pt-1.5">
            <button type="button" onClick={() => signOutUser().then(() => router.push(href("/")))} className={item}><LogOut aria-hidden className="size-4" />{t.dash.signOut}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function TopBar({ path, drawer, onMenu }: { path: string; drawer: boolean; onMenu(): void }) {
  const { t, href } = useLocale()
  return (
    <header className="fs-glass sticky top-0 z-20 border-b border-line print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-1.5">
          <button type="button" data-tour="menu" aria-label={t.dash.openMenu} aria-expanded={drawer} onClick={onMenu} className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-muted lg:hidden">
            <Menu aria-hidden className="size-5" />
          </button>
          <span className="lg:hidden"><Logo href={href("/app")} /></span>
          <Crumbs path={path} />
        </div>
        <Suspense fallback={null}><TopSearch className="mx-2 hidden max-w-xs flex-1 sm:block" /></Suspense>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Suspense fallback={null}>
            <SportSwitcher path={path} className="hidden sm:block" />
            <LanguageSwitch path={path} />
          </Suspense>
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-2 sm:hidden">
        <Suspense fallback={null}>
          <TopSearch className="flex-1" />
          <SportSwitcher path={path} />
        </Suspense>
      </div>
    </header>
  )
}

function Frame({ path, children }: { path: string; children: React.ReactNode }) {
  const { href } = useLocale()
  const [drawer, setDrawer] = useState(false)
  useEffect(() => setDrawer(false), [path])
  return (
    <div className="min-h-dvh bg-bg lg:pl-[var(--sidebar-w)]">
      <NavProgress />
      <RevealObserver />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] lg:flex print:hidden"><Sidebar path={path} /></aside>
      <Drawer open={drawer} onClose={() => setDrawer(false)} path={path} />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <TopBar path={path} drawer={drawer} onMenu={() => setDrawer(true)} />
        <OfflineBanner />
        <div className="flex-1 pb-20 lg:pb-4"><PaywallGate path={path}>{children}<HouseAd /></PaywallGate></div>
        <footer className="hidden px-10 pb-6 text-xs text-ink-3 lg:block print:hidden">
          <ul className="mx-auto flex max-w-[1280px] flex-wrap gap-x-4 gap-y-1">
            {POLICIES.map((policy) => <li key={policy.slug}><Link className="hover:text-ink" href={href(`/${policy.slug}`)}>{policy.label}</Link></li>)}
          </ul>
        </footer>
      </div>
      <MobileTabs path={path} />
      <AppTour />
    </div>
  )
}

/** Every product route needs a signed-in, verified account. Plans are enforced by the API. */
export function AppShell({ children, community }: { children: React.ReactNode; community: boolean }) {
  const { t, href } = useLocale()
  const router = useRouter()
  const path = stripLocale(usePathname() ?? "/app")
  const { user, ready } = useAuthState()
  const { ready: prefsReady } = usePreferences()
  const gateOpen = ready && Boolean(user?.emailVerified)
  const workspaceReady = gateOpen && prefsReady
  const showBoot = useExit(!workspaceReady, 340)

  useEffect(() => {
    if (!ready) return
    if (!user) router.replace(href(`/signin?next=${encodeURIComponent(path + window.location.search)}`))
    else if (!user.emailVerified) router.replace(href("/verify-email"))
  }, [ready, user, router, href, path])

  if (!gateOpen || !user) return <BootLoader status={t.dash.loading} />

  return (
    <AccountProvider user={user} community={community}>
      {showBoot && <BootLoader status={t.dash.loading} leaving={workspaceReady} />}
      <Frame path={path}>{children}</Frame>
    </AccountProvider>
  )
}
