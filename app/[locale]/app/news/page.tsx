import Link from "next/link"
import { ChevronLeft, ChevronRight, Newspaper, Search, X } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { ForYouReports } from "@/components/reports/paid-report"
import { LeadStory, NewsCard, newsChip } from "@/components/reports/news-card"
import { AppPage, btn, EmptyState, PageHeader } from "@/components/site/states"
import { SportIcon } from "@/components/site/sport-icon"
import { FilterSelect } from "@/components/sports/filter-select"
import { filterReports, pageOfReports, reportCompetitions, reportTeams } from "@/lib/content/news"
import { listNewsReports, type ReportType } from "@/lib/content/reports"
import { pageContext, titled } from "@/lib/page-context"
import { enabledSports } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"
import { FollowedTeams } from "./news-filters"

export const generateMetadata = titled((t) => t.news.title)
export const dynamic = "force-dynamic"

const TYPES: ReportType[] = ["preview", "result", "recap", "roundup"]

type Search = { q?: string; team?: string; competition?: string; sport?: string; type?: string; page?: string }
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Search> }

export default async function NewsPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const query = await searchParams
  const sports = enabledSports()
  const q = (query.q ?? "").trim().slice(0, 80)
  const team = (query.team ?? "").slice(0, 120)
  const competition = (query.competition ?? "").slice(0, 200)
  const sport = sports.find((item) => item.id === query.sport) ?? null
  const type = TYPES.find((item) => item === query.type)
  const { state, reports } = await listNewsReports(locale, (sport?.id as SportId) ?? null, sports.map((item) => item.id))
  if (state === "withheld") return <MemberDataPending />

  const filtering = Boolean(q || team || competition || type)
  const matching = filterReports(reports, { q, team, competition, type })
  const { items, page, pages } = pageOfReports(matching, Number(query.page) || 1)
  const [lead, ...rest] = page === 1 ? items : []
  const cards = page === 1 ? rest : items

  const inCompetition = competition ? reports.filter((report) => report.competition === competition) : reports
  const competitions = reportCompetitions(reports)
  const teams = reportTeams(inCompetition)
  const withSelected = (options: string[], selected: string) => (selected && !options.includes(selected) ? [selected, ...options] : options)

  const kept = { ...(sport ? { sport: sport.id } : {}), ...(type ? { type } : {}), ...(q ? { q } : {}), ...(competition ? { competition } : {}), ...(team ? { team } : {}) }
  const link = (next: Partial<Record<keyof typeof kept | "page", string>>, drop: string[] = []) => {
    const merged: Record<string, string> = { ...kept, ...next }
    for (const key of drop) delete merged[key]
    const search = new URLSearchParams(merged).toString()
    return href(`/app/news${search ? `?${search}` : ""}`)
  }
  const sportLink = (id?: string) => link(id ? { sport: id } : {}, ["competition", "team", ...(id ? [] : ["sport"])])
  const { team: _team, ...withoutTeam } = kept
  const sportName = sport?.name[locale] ?? ""

  return (
    <AppPage>
      <PageHeader title={t.news.title} lead={t.news.lead} icon={<Newspaper aria-hidden />} actions={<Link href={href("/app/news/saved")} className={btn("outline", "sm")}>{t.discover.saved}</Link>} />

      <ForYouReports />

      <nav aria-label={t.news.sport} data-testid="news-sports" className="fs-noscrollbar -mx-1 mt-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        <Link href={sportLink()} aria-current={sport ? undefined : "true"} className={newsChip(!sport)}><Newspaper aria-hidden className="size-4" />{t.news.allSports}</Link>
        {sports.map((item) => (
          <Link key={item.id} href={sportLink(item.id)} aria-current={sport?.id === item.id ? "true" : undefined} className={newsChip(sport?.id === item.id)}>
            <SportIcon id={item.id} className="size-4" />{item.name[locale]}
          </Link>
        ))}
      </nav>

      <form role="search" data-testid="news-filters" className="fs-rise mt-3 grid gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        {sport && <input type="hidden" name="sport" value={sport.id} />}
        {type && <input type="hidden" name="type" value={type} />}
        <div className="relative">
          <label htmlFor="news-q" className="mb-1 block text-xs font-medium text-ink-2">{t.reports.search}</label>
          <Search aria-hidden className="pointer-events-none absolute bottom-3 left-3 size-4 text-ink-3" />
          <input id="news-q" type="search" name="q" defaultValue={q} placeholder={t.reports.search} className="fs-input h-10 pl-9 text-sm" />
        </div>
        <div>
          <label htmlFor="news-competition" className="mb-1 block text-xs font-medium text-ink-2">{t.reports.competition}</label>
          <FilterSelect id="news-competition" name="competition" value={competition} className="fs-input h-10 px-3 text-sm">
            <option value="">{t.reports.allCompetitions}</option>
            {withSelected(competitions, competition).map((name) => <option key={name} value={name}>{name}</option>)}
          </FilterSelect>
        </div>
        <div>
          <label htmlFor="news-team" className="mb-1 block text-xs font-medium text-ink-2">{t.news.team}</label>
          <FilterSelect id="news-team" name="team" value={team} className="fs-input h-10 px-3 text-sm">
            <option value="">{t.news.allTeams}</option>
            {withSelected(teams, team).map((name) => <option key={name} value={name}>{name}</option>)}
          </FilterSelect>
        </div>
        <div className="flex items-center gap-1">
          <button type="submit" className={btn("navy", "sm", "min-h-10")}>{t.reports.searchButton}</button>
          {filtering && <Link href={sportLink(sport?.id)} aria-label={t.ui.clearFilters} className="inline-flex size-10 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"><X aria-hidden className="size-4" /></Link>}
        </div>
      </form>

      <div className="mt-3 space-y-2">
        <nav aria-label={t.news.type} data-testid="news-types" className="fs-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
          <Link href={link({}, ["type"])} aria-current={type ? undefined : "true"} className={newsChip(!type)}>{t.news.allTypes}</Link>
          {TYPES.map((item) => <Link key={item} href={link({ type: item })} aria-current={type === item ? "true" : undefined} className={newsChip(type === item)}>{t.reports.types[item]}</Link>)}
        </nav>
        <FollowedTeams query={withoutTeam} team={team} />
      </div>

      {state === "unavailable" && <div className="mt-4"><ErrorNotice>{t.reports.unavailable}</ErrorNotice></div>}

      {state === "ok" && reports.length === 0 && (sport ? (
        <EmptyState
          className="mt-4"
          icon={<SportIcon id={sport.id} />}
          title={t.news.emptySport.replace("{sport}", sportName)}
          body={t.news.emptySportBody}
          action={{ href: href(`/app/scores?sport=${sport.id}`), label: t.news.sportScores.replace("{sport}", sportName) }}
        >
          <Link href={sportLink()} className={btn("outline", "sm")}>{t.news.seeAll}</Link>
        </EmptyState>
      ) : <EmptyState className="mt-4" icon={<Newspaper aria-hidden />} title={t.news.empty} body={t.news.emptyBody} action={{ href: href("/app/scores"), label: t.news.cta }} />)}

      {reports.length > 0 && matching.length === 0 && <EmptyState className="mt-4" compact icon={<Search aria-hidden />} title={t.reports.noMatches} action={{ href: sportLink(sport?.id), label: t.ui.clearFilters }} />}

      {matching.length > 0 && (
        <>
          <ul data-testid="news-list" className="fs-stagger mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lead && <li className="min-w-0 sm:col-span-2 xl:row-span-2"><LeadStory report={lead} t={t} locale={locale} href={href} /></li>}
            {cards.map((report) => <li key={report.id} className="min-w-0"><NewsCard report={report} t={t} locale={locale} href={href} /></li>)}
          </ul>
          <p className="mt-4 text-xs leading-5 text-ink-3">{t.reports.labelHelp}</p>
          {pages > 1 && (
            <nav aria-label={t.news.title} className="mt-4 flex items-center justify-between gap-3">
              {page > 1 ? <Link href={link({ page: String(page - 1) })} rel="prev" className={btn("outline", "md")}><ChevronLeft aria-hidden className="size-4" /> {t.scores.previous}</Link> : <span />}
              <span className="tabular text-sm text-ink-2">{t.scores.pageOf.replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
              {page < pages ? <Link href={link({ page: String(page + 1) })} rel="next" className={btn("outline", "md")}>{t.scores.next} <ChevronRight aria-hidden className="size-4" /></Link> : <span />}
            </nav>
          )}
        </>
      )}
    </AppPage>
  )
}
