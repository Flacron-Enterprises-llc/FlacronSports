"use client"

import { byImportance, byStatusThenTime } from "@/lib/sports/priority"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, Check, LayoutGrid, MessageCircleQuestion, Newspaper, PlayCircle, Radio, Star, TrendingUp, Trophy, X } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, chipClass, EmptyState, Meter, Panel, StatTile } from "@/components/site/states"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import { LiveRefresh, LocalTime } from "@/components/sports/parts"
import { DEFAULT_PREFERENCES, favoriteTotal, type HomeSection } from "@/lib/me/preferences-defaults"
import { followPriority, isFollowed } from "@/lib/sports/following"
import { resolveHomeFeed, trendingCompetitions } from "@/lib/sports/home-feed"
import { readStored, SPOILER_DECIDED_KEY, writeStored } from "@/lib/storage-consent"
import type { Dictionary } from "@/lib/i18n"
import type { EventFeed, SportEvent } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { useAccount } from "./account-context"
import { HighlightsSection } from "./highlights-section"
import { HomeFeedEditor } from "./home-feed-editor"

export interface ReportTeaser {
  id: string
  slug: string
  title: string
  competition: string
  participants: string[]
  publishedAt: string | null
}

const SETUP_HIDDEN_KEY = "fs-setup-hidden"
const NEWS_SHOWN = 4
const PAIRED = new Set<HomeSection>(["upcoming", "results", "trending", "news"])

const SHOW_ALL = "inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-hot-text hover:underline sm:min-h-8"

/** A competition's games as rows in one card. `wide` runs two columns of rows on a large screen. */
function Section({ title, events, t, href, all, live, wide }: { title: string; events: SportEvent[]; t: Dictionary; href: (path: string) => string; all?: string; live?: boolean; wide?: boolean }) {
  if (events.length === 0) return null
  return (
    <section aria-label={title} className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line px-4 py-1.5">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-ink">
          {live && <span aria-hidden className="fs-live-dot size-2 shrink-0 rounded-full bg-live" />}
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {all && <Link href={href(all)} className={SHOW_ALL}>{t.dash.viewAll}<ArrowRight aria-hidden className="size-3.5" /></Link>}
      </div>
      <div className={cn("fs-rows fs-settle", wide && "fs-rows-2")}>
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} layout="row" showCompetition />)}
      </div>
    </section>
  )
}

function Checklist({ onHide }: { onHide(): void }) {
  const { t, href } = useLocale()
  const { prefs } = usePreferences()
  const [decided, setDecided] = useState(false)
  useEffect(() => setDecided(readStored<boolean>(SPOILER_DECIDED_KEY, false)), [])

  const steps = [
    { label: t.dash.checkTeam, done: prefs.favorites.length > 0, to: "/app/scores" },
    { label: t.dash.checkAlerts, done: JSON.stringify(prefs.alerts) !== JSON.stringify(DEFAULT_PREFERENCES.alerts), to: "/app/settings#alerts" },
    { label: t.dash.checkSpoiler, done: prefs.spoilerMode || decided, to: "/app/settings#general" },
  ]
  const finished = steps.filter((step) => step.done).length
  if (finished === steps.length) return null

  return (
    <section aria-label={t.dash.checklist} className="rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{t.dash.checklist}</h2>
        <span className="tabular text-[13px] text-ink-2">{t.ui.stepsDone.replace("{done}", String(finished)).replace("{total}", String(steps.length))}</span>
        <Meter value={finished} max={steps.length} label={t.dash.checklist} className="hidden min-w-16 flex-1 sm:block" />
        <button type="button" aria-label={t.ui.hideChecklist} onClick={onHide} className="-mr-2 ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink sm:size-8"><X aria-hidden className="size-4" /></button>
      </div>
      <ol className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link href={href(step.to)} className="flex min-h-10 items-center gap-2.5 rounded-lg bg-surface-muted px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:text-hot-text">
              {step.done
                ? <span className="fs-form-win inline-flex size-5 shrink-0 items-center justify-center rounded-full"><Check aria-hidden className="size-3.5" /></span>
                : <span aria-hidden className="tabular inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-ink-2">{index + 1}</span>}
              <span className={cn("min-w-0", step.done && "text-ink-2 line-through")}>{step.label}</span>
              <span className="sr-only">{step.done ? t.ui.done : t.ui.notDone}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function QuickActions() {
  const { t, href } = useLocale()
  const actions = [
    { to: "/app/scores?status=live", label: t.ui.quickLive, icon: Radio },
    { to: "/app/my-teams", label: t.ui.quickTeams, icon: Star },
    { to: "/app/board", label: t.discover.boardNav, icon: LayoutGrid },
    { to: "/app/assistant", label: t.ui.quickAsk, icon: MessageCircleQuestion },
    { to: "/app/watch", label: t.ui.quickWatch, icon: PlayCircle },
  ]
  return (
    <nav aria-label={t.ui.quickActions} className="fs-noscrollbar -mx-4 min-w-0 flex-none basis-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:flex-1 sm:basis-0 sm:px-0">
      <ul className="flex gap-1.5">
        {actions.map(({ to, label, icon: Icon }) => (
          <li key={to} className="shrink-0">
            <Link href={href(to)} className={chipClass(false, "font-semibold text-ink")}><Icon aria-hidden className="size-3.5 text-hot-text" />{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Reports({ reports }: { reports: ReportTeaser[] }) {
  const { t, href } = useLocale()
  const { prefs } = usePreferences()
  const followed = new Set(prefs.favorites)
  const leagues = new Set(prefs.leagues.map((league) => league.name))
  const relevant = (report: ReportTeaser) => report.participants.some((name) => followed.has(name)) || leagues.has(report.competition)
  const shown = [...reports.filter(relevant), ...reports.filter((report) => !relevant(report))].slice(0, NEWS_SHOWN)
  return (
    <Panel flush className="h-full" icon={<Newspaper aria-hidden />} title={shown.some(relevant) ? t.discover.relevantNews : t.dash.latestReports} actions={reports.length > 0 ? <Link href={href("/app/news")} className={SHOW_ALL}>{t.dash.allReports}<ArrowRight aria-hidden className="size-3.5" /></Link> : undefined}>
      {reports.length === 0 ? (
        <p className="px-4 py-3.5 text-sm leading-6 text-ink-2 sm:px-5">{t.news.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((report) => (
            <li key={report.id} className="fs-row relative px-4 py-2.5 sm:px-5">
              <Link href={href(`/app/news/${report.slug}`)} className="block text-sm font-medium leading-5 text-ink underline-offset-2 after:absolute after:inset-0 hover:underline">{report.title}</Link>
              <p className="mt-0.5 truncate text-xs text-ink-2">{report.competition}{report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Trending({ feed }: { feed: EventFeed }) {
  const { t, href } = useLocale()
  const copy = t.discover
  const items = trendingCompetitions(feed.events)
  if (items.length === 0) return null
  return (
    <Panel flush className="h-full" title={copy.trending} description={copy.trendingHelp} icon={<TrendingUp aria-hidden />}>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.key} className="fs-row relative flex min-h-11 min-w-0 items-center gap-2.5 px-4 py-1.5 sm:px-5">
            <SportIcon id={item.sportId} className="size-4 shrink-0 text-brand" />
            <Link href={href(`/app/scores?q=${encodeURIComponent(item.name)}`)} className="min-w-0 flex-1 truncate text-sm font-medium text-ink underline-offset-2 after:absolute after:inset-0 hover:underline">{item.name}</Link>
            <span className={cn("tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", item.live > 0 ? "fs-chip-live border" : "bg-surface-muted text-ink-2")}>{(item.live > 0 ? copy.liveGames : copy.games).replace("{live}", String(item.live)).replace("{games}", String(item.games))}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Greeting({ children }: { children: React.ReactNode }) {
  const { locale, t } = useLocale()
  const { user } = useAccount()
  const { prefs } = usePreferences()
  const [now, setNow] = useState<{ hour: number; date: string } | null>(null)

  useEffect(() => {
    const zone = prefs.timeZone !== "UTC" ? { timeZone: prefs.timeZone } : {}
    const date = new Date()
    setNow({
      hour: Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", ...zone }).format(date)),
      date: new Intl.DateTimeFormat(locale, { dateStyle: "full", ...zone }).format(date),
    })
  }, [locale, prefs.timeZone])

  const hello = now === null ? t.dash.hello : now.hour < 12 ? t.ui.morning : now.hour < 18 ? t.ui.afternoon : t.ui.evening
  const first = user?.displayName?.trim().split(/\s+/)[0]

  return (
    <header className="fs-band fs-rise relative overflow-hidden rounded-2xl p-4 sm:p-6">
      <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-8">
        <div className="min-w-0">
          <p className="min-h-5 text-[13px] font-medium capitalize text-white/75">{now?.date}</p>
          <h1 className="mt-0.5 text-[1.625rem] font-semibold leading-tight text-white sm:text-[2rem]">{first ? `${hello}, ${first}` : hello}</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-white/80">{t.dash.lead}</p>
        </div>
        {children}
      </div>
    </header>
  )
}

export function DashboardHome({ feed, reports }: { feed: EventFeed; reports: ReportTeaser[] }) {
  const { t, href } = useLocale()
  const { prefs } = usePreferences()
  const { balance } = useAccount()
  const [setupHidden, setSetupHidden] = useState(true)
  useEffect(() => setSetupHidden(readStored<boolean>(SETUP_HIDDEN_KEY, false)), [])

  const hideSetup = () => {
    writeStored(SETUP_HIDDEN_KEY, true)
    setSetupHidden(true)
  }

  const known = feed.state !== "unavailable"
  const mine = feed.events
    .filter((event) => isFollowed(prefs, event))
    .sort((a, b) => followPriority(prefs, a) - followPriority(prefs, b) || byStatusThenTime(a, b))
  const others = feed.events.filter((event) => !mine.includes(event)).sort(byImportance)
  const live = others.filter((event) => event.status === "live").slice(0, 6)
  const liveTotal = feed.events.filter((event) => event.status === "live").length
  const upcoming = others
    .filter((event) => event.status === "scheduled")
    .slice(0, 6)
  const results = others.filter((event) => event.status === "finished").slice(0, 6)
  const followed = favoriteTotal(prefs)
  const home = resolveHomeFeed(prefs.homeFeed)

  const trending = trendingCompetitions(feed.events).length > 0
  const filled: Record<HomeSection, boolean> = {
    favorites: true,
    live: live.length > 0,
    upcoming: upcoming.length > 0,
    results: results.length > 0,
    highlights: true,
    trending,
    news: true,
  }
  const visible = home.order.filter((section) => !home.hidden.includes(section) && filled[section])
  // The member's order always stands. Neighbours that suit half a page simply share a row.
  const blocks: HomeSection[][] = []
  for (let index = 0; index < visible.length; index++) {
    const section = visible[index]
    const next = visible[index + 1]
    if (next && PAIRED.has(section) && PAIRED.has(next)) {
      blocks.push([section, next])
      index++
    } else blocks.push([section])
  }

  const render = (section: HomeSection, wide: boolean): React.ReactNode => ({
    favorites: (
      <>
        {followed === 0 && <EmptyState inline icon={<Star aria-hidden />} title={t.dash.favorites} body={t.dash.pickTeams} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />}
        {followed > 0 && mine.length === 0 && known && <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">{t.dash.noFavorites}</p>}
        <Section title={t.dash.favorites} events={mine} t={t} href={href} all="/app/my-teams" wide />
      </>
    ),
    live: <Section title={t.dash.liveNow} events={live} t={t} href={href} all="/app/scores?status=live" live wide={wide} />,
    upcoming: <Section title={t.dash.upcoming} events={upcoming} t={t} href={href} all="/app/scores?status=upcoming" wide={wide} />,
    results: <Section title={t.dash.results} events={results} t={t} href={href} all="/app/scores?status=finished" wide={wide} />,
    highlights: <HighlightsSection />,
    trending: <Trending feed={feed} />,
    news: <Reports reports={reports} />,
  })[section]

  return (
    <AppPage>
      <LiveRefresh live={liveTotal > 0} />
      <div className="space-y-4">
        <Greeting>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:w-[35rem]">
            <StatTile band label={t.dash.liveNow} value={known ? liveTotal : null} icon={<Radio aria-hidden />} tone="live" href={href("/app/scores?status=live")} />
            <StatTile band label={t.ui.statFixtures} value={known ? feed.events.length : null} icon={<CalendarDays aria-hidden />} href={href("/app/scores")} />
            <StatTile band label={t.ui.statTeams} value={followed} icon={<Star aria-hidden />} href={href("/app/my-teams")} />
            <StatTile band label={t.ui.statRequests} value={balance ? balance.remaining : null} icon={<MessageCircleQuestion aria-hidden />} href={href("/app/assistant")} />
          </div>
        </Greeting>

        {!setupHidden && <Checklist onHide={hideSetup} />}

        <div className="flex flex-wrap items-center gap-2">
          <QuickActions />
          <HomeFeedEditor />
        </div>

        {blocks.map((block) => (
          <div key={block.join("-")} className={cn("grid min-w-0 gap-4 empty:hidden", block.length > 1 && "lg:grid-cols-2")}>
            {block.map((section) => <div key={section} className="min-w-0 space-y-4 empty:hidden">{render(section, block.length === 1)}</div>)}
          </div>
        ))}
        {feed.events.length === 0 && known && <EmptyState compact icon={<Trophy aria-hidden />} title={t.dash.nothing} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />}
        <FeedNotice feed={feed} t={t} />
        <p className="flex items-start gap-1.5 text-xs leading-5 text-ink-2"><Newspaper aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t.reports.labelHelp}</p>
      </div>
    </AppPage>
  )
}
