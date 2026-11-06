import Link from "next/link"
import { ChevronLeft, ChevronRight, Search, Trophy, X } from "lucide-react"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, btn, EmptyState, PageHeader } from "@/components/site/states"
import { DateJump } from "@/components/sports/date-jump"
import { FeedNotice } from "@/components/sports/event-card"
import { CompetitionGroupSection } from "@/components/sports/competition-group"
import { LiveRefresh } from "@/components/sports/parts"
import { pageContext, titled } from "@/lib/page-context"
import { enabledSports, getEvents, utcDate } from "@/lib/sports/service"
import { groupByCompetition, pageOfGroups } from "@/lib/sports/priority"
import type { EventStatus, SportId } from "@/lib/sports/types"
import { cn } from "@/lib/utils"

export const generateMetadata = titled((t) => t.scores.title)

type Search = { sport?: string; status?: string; date?: string; q?: string; page?: string }
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Search> }

const TABS = [
  ["all", null],
  ["live", ["live"]],
  ["upcoming", ["scheduled"]],
  ["finished", ["finished"]],
  ["other", ["postponed", "canceled", "interrupted", "abandoned", "unknown"]],
] as const

const PAGE_SIZE = 60
const shiftDate = (date: string, days: number) => utcDate(new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000))

export default async function ScoresPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const search = await searchParams

  const sport = enabledSports().find((candidate) => candidate.id === search.sport)?.id as SportId | undefined
  const today = utcDate()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(search.date ?? "") ? (search.date as string) : today
  const tab = TABS.find(([key]) => key === search.status) ?? TABS[0]
  const q = (search.q ?? "").trim().slice(0, 80)

  const feed = await getEvents({ date, sport })
  const needle = q.toLowerCase()
  const matching = feed.events.filter((event) => !needle || [event.competition.name, event.eventName ?? "", ...event.participants.map((participant) => participant.name)].some((text) => text.toLowerCase().includes(needle)))
  const inTab = (key: (typeof TABS)[number]) => matching.filter((event) => !key[1] || (key[1] as readonly EventStatus[]).includes(event.status))
  const events = inTab(tab)
  const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1), pages)
  const groups = groupByCompetition(events)
  const shown = pageOfGroups(groups, page, PAGE_SIZE)
  const totals = new Map(groups.map((group) => [group.key, group.events.length]))

  const link = (overrides: Search) => {
    const query = new URLSearchParams()
    const merged = { sport, status: search.status, date: search.date, q: q || undefined, ...overrides }
    for (const [key, value] of Object.entries(merged)) if (value && value !== "all") query.set(key, value)
    const text = query.toString()
    return href(text ? `/app/scores?${text}` : "/app/scores")
  }
  const dated = (value: string) => link({ date: value === today ? undefined : value })

  const day = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })
  const strip = [-3, -2, -1, 0, 1, 2, 3].map((offset) => shiftDate(date, offset))
  const chip = (active: boolean) =>
    cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors", active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink")

  return (
    <AppPage>
      <LiveRefresh live={date === today && feed.events.some((event) => event.status === "live")} />
      <PageHeader title={t.scores.title} lead={t.scores.lead} icon={<Trophy aria-hidden />} />

      <div className="fs-rise rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)] sm:p-4" style={{ ["--i" as string]: 1 }}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={dated(shiftDate(date, -1))} aria-label={t.ui.previousDay} className={btn("outline", "md", "size-10 shrink-0 px-0")}><ChevronLeft aria-hidden className="size-4" /></Link>
          <ol className="fs-noscrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {strip.map((value) => {
              const active = value === date
              const when = new Date(`${value}T12:00:00Z`)
              return (
                <li key={value} className="min-w-[3.25rem] flex-1">
                  <Link href={dated(value)} aria-current={active ? "date" : undefined} className={cn("flex min-h-10 flex-col items-center justify-center rounded-lg px-1 py-1 text-center transition-colors", active ? "bg-navy text-white dark:bg-brand dark:text-brand-on" : "text-ink-2 hover:bg-surface-muted hover:text-ink")}>
                    <span className="text-[11px] font-medium capitalize leading-4">{value === today ? t.ui.today : day.format(when)}</span>
                    <span className="tabular whitespace-nowrap text-[13px] font-semibold leading-4">{dayNumber.format(when)}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <Link href={dated(shiftDate(date, 1))} aria-label={t.ui.nextDay} className={btn("outline", "md", "size-10 shrink-0 px-0")}><ChevronRight aria-hidden className="size-4" /></Link>
          <DateJump value={date} template={link({ date: "{date}" }).replace("%7Bdate%7D", "{date}")} />
        </div>

        <form className="relative mt-3" role="search">
          {sport && <input type="hidden" name="sport" value={sport} />}
          {search.status && <input type="hidden" name="status" value={search.status} />}
          {search.date && <input type="hidden" name="date" value={search.date} />}
          <label htmlFor="scores-q" className="sr-only">{t.scores.search}</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input id="scores-q" type="search" name="q" defaultValue={q} placeholder={t.scores.search} className="fs-input h-10 pl-9 pr-24 text-sm" />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {q && <Link href={link({ q: undefined })} aria-label={t.ui.clearSearch} className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"><X aria-hidden className="size-4" /></Link>}
            <button type="submit" className={btn("navy", "sm", "min-h-8")}>{t.scores.apply}</button>
          </div>
        </form>

        <nav aria-label={t.scores.title} className="fs-noscrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {TABS.map((item) => {
            const [key] = item
            const count = inTab(item).length
            return (
              <Link key={key} href={link({ status: key })} aria-current={tab[0] === key ? "page" : undefined} className={chip(tab[0] === key)}>
                {key === "live" && count > 0 && <span aria-hidden className="fs-live-dot size-1.5 rounded-full bg-live" />}
                {t.scores[key]}{feed.state !== "unavailable" && <span className="tabular text-xs opacity-80">{count}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="fs-noscrollbar mt-2 flex gap-1.5 overflow-x-auto">
          <Link href={link({ sport: undefined })} aria-current={!sport ? "true" : undefined} className={chip(!sport)}>{t.scores.allSports}</Link>
          {enabledSports().map((item) => (
            <Link key={item.id} href={link({ sport: item.id })} aria-current={sport === item.id ? "true" : undefined} className={chip(sport === item.id)}>
              <SportIcon id={item.id} className="size-3.5" />{item.name[locale]}
            </Link>
          ))}
        </div>
      </div>

      {events.length > 0 && (
        <div className="mt-5 space-y-6">
          {shown.map((group) => <CompetitionGroupSection key={group.key} group={group} total={totals.get(group.key) ?? group.events.length} t={t} href={href} />)}
        </div>
      )}
      {pages > 1 && (
        <nav aria-label={t.scores.title} className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} rel="prev" className={btn("outline", "md")}><ChevronLeft aria-hidden className="size-4" /> {t.scores.previous}</Link> : <span />}
          <span className="tabular text-sm text-ink-2">{t.scores.pageOf.replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
          {page < pages ? <Link href={link({ page: String(page + 1) })} rel="next" className={btn("outline", "md")}>{t.scores.next} <ChevronRight aria-hidden className="size-4" /></Link> : <span />}
        </nav>
      )}
      {events.length === 0 && feed.state !== "unavailable" && (
        <EmptyState className="mt-5" icon={<Trophy aria-hidden />} title={t.scores.empty} body={t.ui.scoresEmptyBody} action={q || sport || search.status ? { href: dated(date).split("?")[0] + (date !== today ? `?date=${date}` : ""), label: t.ui.clearFilters } : undefined} />
      )}
      <div className="mt-5"><FeedNotice feed={feed} t={t} /></div>
    </AppPage>
  )
}
