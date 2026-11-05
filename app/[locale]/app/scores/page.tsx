import type { Metadata } from "next"
import Link from "next/link"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import { EmptyState, PageHeader } from "@/components/site/states"
import { pageContext } from "@/lib/page-context"
import { enabledSports, getEvents, utcDate } from "@/lib/sports/service"
import type { EventStatus, SportId } from "@/lib/sports/types"

export const metadata: Metadata = { title: "Scores" }

type Search = { sport?: string; status?: string; date?: string; q?: string }
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Search> }

const TABS = [["all", null], ["live", ["live"]], ["upcoming", ["scheduled"]], ["finished", ["finished"]]] as const

export default async function ScoresPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const search = await searchParams

  const sport = enabledSports().find((candidate) => candidate.id === search.sport)?.id as SportId | undefined
  const date = /^\d{4}-\d{2}-\d{2}$/.test(search.date ?? "") ? (search.date as string) : utcDate()
  const tab = TABS.find(([key]) => key === search.status) ?? TABS[0]
  const q = (search.q ?? "").trim().slice(0, 80)

  const feed = await getEvents({ date, sport })
  const needle = q.toLowerCase()
  const events = feed.events.filter((event) => {
    if (tab[1] && !(tab[1] as readonly EventStatus[]).includes(event.status)) return false
    if (!needle) return true
    return [event.competition.name, event.eventName ?? "", ...event.participants.map((participant) => participant.name)].some((text) => text.toLowerCase().includes(needle))
  })

  const link = (overrides: Search) => {
    const query = new URLSearchParams()
    const merged = { sport, status: search.status, date: search.date, q: q || undefined, ...overrides }
    for (const [key, value] of Object.entries(merged)) if (value && value !== "all") query.set(key, value)
    const text = query.toString()
    return href(text ? `/app/scores?${text}` : "/app/scores")
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:text-ink"}`

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={t.scores.title} lead={t.scores.lead} />

      <nav aria-label={t.scores.title} className="flex flex-wrap gap-2">
        {TABS.map(([key]) => (
          <Link key={key} href={link({ status: key })} aria-current={tab[0] === key ? "page" : undefined} className={chip(tab[0] === key)}>{t.scores[key]}</Link>
        ))}
      </nav>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={link({ sport: undefined })} className={chip(!sport)}>{t.scores.allSports}</Link>
        {enabledSports().map((item) => (
          <Link key={item.id} href={link({ sport: item.id })} className={chip(sport === item.id)}>{item.name[locale]}</Link>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3">
        {sport && <input type="hidden" name="sport" value={sport} />}
        {search.status && <input type="hidden" name="status" value={search.status} />}
        <label className="text-sm font-medium text-ink">
          {t.scores.date}
          <input type="date" name="date" defaultValue={date} className="mt-1 block rounded-md border border-line bg-surface px-3 py-2 text-ink" />
        </label>
        <label className="min-w-56 flex-1 text-sm font-medium text-ink">
          {t.scores.search}
          <input type="search" name="q" defaultValue={q} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" />
        </label>
        <button type="submit" className="rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-deep">{t.scores.apply}</button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
      </div>
      {events.length === 0 && feed.state !== "unavailable" && <EmptyState title={t.scores.empty} body={t.feed.limited} />}
      <div className="mt-4"><FeedNotice feed={feed} t={t} /></div>
    </main>
  )
}
