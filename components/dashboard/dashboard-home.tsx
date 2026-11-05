"use client"

import Link from "next/link"
import { Check, Circle } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import type { Dictionary } from "@/lib/i18n"
import { useLocale } from "@/lib/use-locale"
import type { EventFeed, SportEvent } from "@/lib/sports/types"

function Section({ title, events, t, href, all }: { title: string; events: SportEvent[]; t: Dictionary; href: (path: string) => string; all?: string }) {
  if (events.length === 0) return null
  return (
    <section aria-label={title} className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {all && <Link href={href(all)} className="text-sm font-semibold text-hot-text hover:underline">{t.dash.viewAll}</Link>}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
      </div>
    </section>
  )
}

export function DashboardHome({ feed }: { feed: EventFeed }) {
  const { t, href } = useLocale()
  const { prefs } = usePreferences()
  const mine = feed.events.filter((event) => event.participants.some((participant) => prefs.favorites.includes(participant.name)))
  const live = feed.events.filter((event) => event.status === "live")
  const upcoming = feed.events.filter((event) => event.status === "scheduled").slice(0, 6)
  const results = feed.events.filter((event) => event.status === "finished").slice(0, 6)

  const steps = [
    { label: t.dash.checkTeam, done: prefs.favorites.length > 0, to: "/app/scores" },
    { label: t.dash.checkAlerts, done: prefs.alerts.types.length > 2, to: "/app/settings" },
    { label: t.dash.checkSpoiler, done: prefs.spoilerMode, to: "/app/settings" },
  ]
  const open = steps.some((step) => !step.done)

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pb-2 pt-8">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t.dash.hello}</h1>
        <p className="mt-2 text-ink-2">{t.dash.lead}</p>
      </header>

      {open && (
        <section aria-label={t.dash.checklist} className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">{t.dash.checklist}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.label}>
                <Link href={href(step.to)} className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
                  {step.done ? <Check aria-hidden className="size-4 text-good" /> : <Circle aria-hidden className="size-4 text-ink-3" />}
                  {step.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {prefs.favorites.length > 0 && mine.length === 0 && (
        <p className="mt-6 rounded-lg border border-line bg-surface p-3 text-sm text-ink-2">{t.dash.noFavorites}</p>
      )}
      <Section title={t.dash.favorites} events={mine} t={t} href={href} />
      <Section title={t.dash.liveNow} events={live} t={t} href={href} all="/app/scores?status=live" />
      <Section title={t.dash.upcoming} events={upcoming} t={t} href={href} all="/app/scores?status=upcoming" />
      <Section title={t.dash.results} events={results} t={t} href={href} all="/app/scores?status=finished" />
      {feed.events.length === 0 && feed.state !== "unavailable" && <p className="mt-6 text-sm text-ink-2">{t.dash.nothing}</p>}
      <div className="mt-6"><FeedNotice feed={feed} t={t} /></div>
    </main>
  )
}
