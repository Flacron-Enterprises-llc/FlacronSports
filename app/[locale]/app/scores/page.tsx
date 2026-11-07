import Link from "next/link"
import { ChevronLeft, ChevronRight, Globe2, Search, Trophy, X } from "lucide-react"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, btn, chipClass, EmptyState, PageHeader } from "@/components/site/states"
import { DateJump } from "@/components/sports/date-jump"
import { FeedNotice } from "@/components/sports/event-card"
import { CompetitionGroupSection } from "@/components/sports/competition-group"
import { FavoritesFilter } from "@/components/sports/favorites-filter"
import { FilterSelect } from "@/components/sports/filter-select"
import { LiveRefresh } from "@/components/sports/parts"
import { pageContext, titled } from "@/lib/page-context"
import { isAfricanEvent } from "@/lib/sports/africa"
import { enabledSports, getEvents, utcDate } from "@/lib/sports/service"
import { groupByCompetition, pageOfGroups } from "@/lib/sports/priority"
import { competitionOptions, filterScores, parseFollowFilter } from "@/lib/sports/score-filters"
import type { EventStatus, SportId } from "@/lib/sports/types"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.scores.title)

type Search = { sport?: string; status?: string; date?: string; q?: string; page?: string; competition?: string; fav?: string; favl?: string; region?: string }
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
  if (feed.state === "withheld") return <MemberDataPending />
  // Built from the whole day, so choosing one competition leaves the others in the list.
  const competitions = competitionOptions(feed.events)
  const competition = competitions.find((option) => option.key === search.competition)?.key
  const following = parseFollowFilter(search.fav, search.favl)
  const africa = search.region === "africa"
  const matching = filterScores(feed.events, { q, competition, following }).filter((event) => !africa || isAfricanEvent(event))
  const inTab = (key: (typeof TABS)[number]) => matching.filter((event) => !key[1] || (key[1] as readonly EventStatus[]).includes(event.status))
  const events = inTab(tab)
  const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1), pages)
  const groups = groupByCompetition(events)
  const shown = pageOfGroups(groups, page, PAGE_SIZE)
  const totals = new Map(groups.map((group) => [group.key, group.events.length]))

  const link = (overrides: Search) => {
    const query = new URLSearchParams()
    const merged = { sport, status: search.status, date: search.date, q: q || undefined, competition, fav: search.fav, favl: search.favl, region: search.region, ...overrides }
    for (const [key, value] of Object.entries(merged)) if (value && value !== "all") query.set(key, value)
    const text = query.toString()
    return href(text ? `/app/scores?${text}` : "/app/scores")
  }
  const dated = (value: string) => link({ date: value === today ? undefined : value })

  const day = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
  const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })
  const strip = [-3, -2, -1, 0, 1, 2, 3].map((offset) => shiftDate(date, offset))
  const hiddenFilters = (
    <>
      {search.fav && <input type="hidden" name="fav" value={search.fav} />}
      {search.favl && <input type="hidden" name="favl" value={search.favl} />}
    </>
  )

  return (
    <AppPage>
      <LiveRefresh live={date === today && feed.events.some((event) => event.status === "live")} />
      <PageHeader title={t.scores.title} lead={t.scores.lead} icon={<Trophy aria-hidden />} />

      <div className="fs-rise rounded-xl border border-line bg-surface p-2.5 shadow-[var(--shadow-sm)] sm:p-3" style={{ ["--i" as string]: 1 }}>
        <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
          <Link href={dated(shiftDate(date, -1))} aria-label={t.ui.previousDay} className={btn("ghost", "md", "size-10 shrink-0 px-0")}><ChevronLeft aria-hidden className="size-4" /></Link>
          <ol className="fs-noscrollbar flex min-w-0 flex-1 basis-0 gap-1 overflow-x-auto">
            {strip.map((value) => {
              const active = value === date
              const when = new Date(`${value}T12:00:00Z`)
              return (
                <li key={value} className="min-w-[3.25rem] flex-1">
                  <Link href={dated(value)} aria-current={active ? "date" : undefined} className={cn("flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-1 text-center transition-colors", active ? "bg-navy text-white dark:bg-brand dark:text-brand-on" : "text-ink-2 hover:bg-surface-muted hover:text-ink")}>
                    <span className="text-[11px] font-medium capitalize leading-4">{value === today ? t.ui.today : day.format(when)}</span>
                    <span className="tabular whitespace-nowrap text-[13px] font-semibold leading-4">{dayNumber.format(when)}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <Link href={dated(shiftDate(date, 1))} aria-label={t.ui.nextDay} className={btn("ghost", "md", "size-10 shrink-0 px-0")}><ChevronRight aria-hidden className="size-4" /></Link>
          <div className="w-full sm:w-40 sm:shrink-0"><DateJump value={date} template={link({ date: "{date}" }).replace("%7Bdate%7D", "{date}")} /></div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2 lg:flex-row lg:items-center">
          <form className="relative min-w-0 lg:flex-1" role="search">
            {sport && <input type="hidden" name="sport" value={sport} />}
            {search.status && <input type="hidden" name="status" value={search.status} />}
            {search.date && <input type="hidden" name="date" value={search.date} />}
            {competition && <input type="hidden" name="competition" value={competition} />}
            {hiddenFilters}
            <label htmlFor="scores-q" className="sr-only">{t.scores.search}</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input id="scores-q" type="search" name="q" defaultValue={q} placeholder={t.scores.search} className="fs-input h-10 pl-9 pr-24 text-sm" />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {q && <Link href={link({ q: undefined })} aria-label={t.ui.clearSearch} className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"><X aria-hidden className="size-4" /></Link>}
              <button type="submit" className={btn("navy", "sm", "min-h-8 sm:min-h-8")}>{t.scores.apply}</button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {competitions.length > 0 && (
              <form className="flex min-w-0 max-w-full items-center gap-2">
                {sport && <input type="hidden" name="sport" value={sport} />}
                {search.status && <input type="hidden" name="status" value={search.status} />}
                {search.date && <input type="hidden" name="date" value={search.date} />}
                {q && <input type="hidden" name="q" value={q} />}
                {hiddenFilters}
                <label htmlFor="scores-competition" className="sr-only">{t.scores.competition}</label>
                <FilterSelect id="scores-competition" name="competition" value={competition ?? ""} className="fs-input h-10 w-full max-w-72 px-2 text-sm sm:w-64">
                  <option value="">{t.scores.allCompetitions}</option>
                  {competitions.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
                </FilterSelect>
                <noscript><button type="submit" className={btn("outline", "sm")}>{t.scores.apply}</button></noscript>
              </form>
            )}
            <FavoritesFilter />
          </div>
        </div>
      </div>

      <div className="fs-stick fs-glass -mx-4 mt-3 border-b border-line px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="fs-noscrollbar flex items-center gap-1.5 overflow-x-auto">
          <nav aria-label={t.scores.title} className="flex shrink-0 gap-1.5">
            {TABS.map((item) => {
              const [key] = item
              const count = inTab(item).length
              return (
                <Link key={key} href={link({ status: key })} aria-current={tab[0] === key ? "page" : undefined} className={chipClass(tab[0] === key)}>
                  {key === "live" && count > 0 && <span aria-hidden className="fs-live-dot size-1.5 rounded-full bg-live" />}
                  {t.scores[key]}{feed.state !== "unavailable" && <span className="tabular text-xs opacity-80">{count}</span>}
                </Link>
              )
            })}
          </nav>
          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line" />
          <Link href={link({ sport: undefined, competition: undefined })} aria-current={!sport ? "true" : undefined} className={chipClass(!sport)}>{t.scores.allSports}</Link>
          <Link href={link({ region: africa ? undefined : "africa", competition: undefined })} aria-pressed={africa} className={chipClass(africa)}><Globe2 aria-hidden className="size-3.5" />{t.discover.africaFilter}</Link>
          {enabledSports().map((item) => (
            <Link key={item.id} href={link({ sport: item.id, competition: undefined })} aria-current={sport === item.id ? "true" : undefined} className={chipClass(sport === item.id)}>
              <SportIcon id={item.id} className="size-3.5" />{item.name[locale]}
            </Link>
          ))}
        </div>
      </div>

      {events.length > 0 && (
        <div className="mt-4 space-y-4">
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
      {sport && feed.nextDates && feed.nextDates.length > 0 && (
        <nav aria-label={t.scores.nextDates} data-testid="next-dates" className="mt-4 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold text-ink">{t.scores.nextDates}</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {feed.nextDates.map((item) => (
              <li key={item.date}>
                <Link href={dated(item.date)} className={chipClass(false)}>
                  <span className="capitalize">{day.format(new Date(`${item.date}T12:00:00Z`))} {dayNumber.format(new Date(`${item.date}T12:00:00Z`))}</span>
                  <span className="tabular text-xs opacity-80">{(item.games === 1 ? t.scores.oneGame : t.scores.games).replace("{count}", String(item.games))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {events.length === 0 && feed.state !== "unavailable" && (
        <EmptyState className="mt-4" icon={<Trophy aria-hidden />} title={following ? t.scores.noFavorites : t.scores.empty} body={following ? t.scores.noFavoritesBody : t.ui.scoresEmptyBody} action={q || sport || search.status || competition || africa ? { href: dated(date).split("?")[0] + (date !== today ? `?date=${date}` : ""), label: t.ui.clearFilters } : undefined} />
      )}
      <div className="mt-5"><FeedNotice feed={feed} t={t} /></div>
    </AppPage>
  )
}
