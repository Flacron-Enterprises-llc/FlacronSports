"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, Check, Circle, MessageCircleQuestion, Newspaper, PlayCircle, Radio, Star, Trophy, X } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { EmptyState, Meter, Panel, StatTile, AppPage } from "@/components/site/states"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import { LiveRefresh, LocalTime } from "@/components/sports/parts"
import { DEFAULT_PREFERENCES } from "@/lib/me/preferences-defaults"
import { followsEvent } from "@/lib/sports/following"
import { readStored, SPOILER_DECIDED_KEY, writeStored } from "@/lib/storage-consent"
import type { Dictionary } from "@/lib/i18n"
import type { EventFeed, SportEvent } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { useAccount } from "./account-context"

export interface ReportTeaser {
  id: string
  slug: string
  title: string
  competition: string
  publishedAt: string | null
}

const SETUP_HIDDEN_KEY = "fs-setup-hidden"

function Section({ title, events, t, href, all, live }: { title: string; events: SportEvent[]; t: Dictionary; href: (path: string) => string; all?: string; live?: boolean }) {
  if (events.length === 0) return null
  return (
    <section aria-label={title} className="min-w-0">
      <div className="flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
          {live && <span aria-hidden className="fs-live-dot size-2 rounded-full bg-live" />}
          {title}
        </h2>
        {all && <Link href={href(all)} className="inline-flex items-center gap-1 text-sm font-semibold text-hot-text hover:underline">{t.dash.viewAll}<ArrowRight aria-hidden className="size-3.5" /></Link>}
      </div>
      <div className="fs-stagger mt-3 grid gap-4 sm:grid-cols-2">
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
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
    <Panel
      title={t.dash.checklist}
      description={t.ui.stepsDone.replace("{done}", String(finished)).replace("{total}", String(steps.length))}
      actions={<button type="button" aria-label={t.ui.hideChecklist} onClick={onHide} className="-mr-1 -mt-1 inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"><X aria-hidden className="size-4" /></button>}
    >
      <Meter value={finished} max={steps.length} label={t.dash.checklist} />
      <ul className="mt-3 space-y-0.5">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={href(step.to)} className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 -mx-2 text-sm text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink">
              {step.done ? <Check aria-hidden className="size-4 shrink-0 text-good" /> : <Circle aria-hidden className="size-4 shrink-0 text-ink-3" />}
              <span className={step.done ? "line-through" : ""}>{step.label}</span>
              <span className="sr-only">{step.done ? t.ui.done : t.ui.notDone}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function QuickActions() {
  const { t, href } = useLocale()
  const actions = [
    { to: "/app/scores?status=live", label: t.ui.quickLive, icon: Radio },
    { to: "/app/my-teams", label: t.ui.quickTeams, icon: Star },
    { to: "/app/assistant", label: t.ui.quickAsk, icon: MessageCircleQuestion },
    { to: "/app/watch", label: t.ui.quickWatch, icon: PlayCircle },
  ]
  return (
    <Panel title={t.ui.quickActions}>
      <ul className="grid grid-cols-2 gap-2">
        {actions.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link href={href(to)} className="fs-lift flex h-full min-h-20 flex-col gap-2 rounded-lg border border-line p-3 text-[13px] font-semibold leading-5 text-ink">
              <Icon aria-hidden className="size-4 text-hot-text" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Reports({ reports }: { reports: ReportTeaser[] }) {
  const { t, href } = useLocale()
  return (
    <Panel title={t.dash.latestReports} actions={reports.length > 0 ? <Link href={href("/app/news")} className="text-[13px] font-semibold text-hot-text hover:underline">{t.dash.allReports}</Link> : undefined}>
      {reports.length === 0 ? (
        <p className="text-sm leading-6 text-ink-2">{t.news.empty}</p>
      ) : (
        <ul className="-my-2 divide-y divide-line">
          {reports.map((report) => (
            <li key={report.id} className="py-2.5">
              <Link href={href(`/app/news/${report.slug}`)} className="block text-sm font-medium leading-5 text-ink underline-offset-2 hover:underline">{report.title}</Link>
              <p className="mt-0.5 truncate text-xs text-ink-2">{report.competition}{report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Greeting() {
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
    <header className="fs-band fs-rise relative mb-5 overflow-hidden rounded-2xl p-5 sm:p-7">
      <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative">
        <p className="min-h-5 text-[13px] font-medium capitalize text-white/75">{now?.date}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-[2rem]">{first ? `${hello}, ${first}` : hello}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/80 sm:text-[15px]">{t.dash.lead}</p>
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
  const mine = feed.events.filter((event) => followsEvent(prefs.favorites, event))
  const others = feed.events.filter((event) => !mine.includes(event))
  const live = others.filter((event) => event.status === "live").slice(0, 6)
  const liveTotal = feed.events.filter((event) => event.status === "live").length
  const upcoming = others
    .filter((event) => event.status === "scheduled")
    .sort((a, b) => (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? ""))
    .slice(0, 6)
  const results = others.filter((event) => event.status === "finished").slice(0, 6)

  return (
    <AppPage>
      <LiveRefresh live={liveTotal > 0} />
      <Greeting />

      <div className="fs-stagger grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label={t.ui.statTeams} value={prefs.favorites.length} icon={<Star aria-hidden />} href={href("/app/my-teams")} />
        <StatTile label={t.dash.liveNow} value={known ? liveTotal : null} icon={<Radio aria-hidden />} tone="live" href={href("/app/scores?status=live")} />
        <StatTile label={t.ui.statFixtures} value={known ? feed.events.length : null} icon={<CalendarDays aria-hidden />} href={href("/app/scores")} />
        <StatTile label={t.ui.statRequests} value={balance ? balance.remaining : null} icon={<MessageCircleQuestion aria-hidden />} href={href("/app/assistant")} />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-7">
          {!setupHidden && <div className="xl:hidden"><Checklist onHide={hideSetup} /></div>}
          {prefs.favorites.length === 0 && (
            <EmptyState compact icon={<Star aria-hidden />} title={t.dash.favorites} body={t.dash.pickTeams} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />
          )}
          {prefs.favorites.length > 0 && mine.length === 0 && known && (
            <p className="rounded-xl border border-line bg-surface p-3.5 text-sm text-ink-2">{t.dash.noFavorites}</p>
          )}
          <Section title={t.dash.favorites} events={mine} t={t} href={href} all="/app/my-teams" />
          <Section title={t.dash.liveNow} events={live} t={t} href={href} all="/app/scores?status=live" live />
          <Section title={t.dash.upcoming} events={upcoming} t={t} href={href} all="/app/scores?status=upcoming" />
          <Section title={t.dash.results} events={results} t={t} href={href} all="/app/scores?status=finished" />
          {feed.events.length === 0 && known && <EmptyState compact icon={<Trophy aria-hidden />} title={t.dash.nothing} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />}
          <FeedNotice feed={feed} t={t} />
        </div>
        <aside aria-label={t.ui.quickActions} className="min-w-0 space-y-4">
          {!setupHidden && <div className="hidden xl:block"><Checklist onHide={hideSetup} /></div>}
          <QuickActions />
          <Reports reports={reports} />
          <p className="flex items-center gap-1.5 text-xs text-ink-3"><Newspaper aria-hidden className="size-3.5" />{t.reports.labelHelp}</p>
        </aside>
      </div>
    </AppPage>
  )
}
