import Link from "next/link"
import { headers } from "next/headers"
import { CalendarClock, Clapperboard, PlayCircle, Radio, Search, Tv } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, btn, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { FilterSelect } from "@/components/sports/filter-select"
import { LocalTime } from "@/components/sports/parts"
import { HighlightPlayer } from "@/components/video/highlight-player"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { enabledSports, fromBackend } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { getWatchFeed, type WatchFeed, type WatchFilters } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.watch.title)

const EMPTY: WatchFeed = { live: [], highlights: [], clips: [], broadcasts: [] }

async function loadFeed(sport: SportId | undefined, filters: WatchFilters): Promise<{ feed: WatchFeed; failed: boolean }> {
  const query = new URLSearchParams(Object.entries({ sport, ...filters }).flatMap(([key, value]) => (value ? [[key, value]] : []))).toString()
  const request = process.env.API_ORIGIN ? fromBackend<WatchFeed>(`/api/watch${query ? `?${query}` : ""}`) : getWatchFeed(sport, new Date(), filters)
  const feed = await request.catch(() => null)
  return { feed: feed ?? EMPTY, failed: !feed || feed.state === "unavailable" }
}

function viewerCountry(code: string | null): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null
  } catch {
    return null
  }
}

type Search = { sport?: string; team?: string; competition?: string; watchable?: string }

export default async function WatchPage({ params, searchParams }: LocaleParams & { searchParams: Promise<Search> }) {
  const { t, href, locale } = await pageContext(params)
  const search = await searchParams
  const sports = enabledSports()
  const sport = sports.find((item) => item.id === search.sport)?.id
  const team = (search.team ?? "").trim().slice(0, 80)
  const competition = (search.competition ?? "").slice(0, 120)
  const watchable = search.watchable === "1"
  const { feed, failed } = await loadFeed(sport, { team: team || undefined, competition: competition || undefined })
  const country = viewerCountry((await headers()).get("cloudfront-viewer-country"))
  const broadcasts = [...feed.broadcasts].sort((a, b) => Number(b.country === country) - Number(a.country === country))
  const clips = feed.clips ?? []
  const playable = feed.highlights.length + clips.length
  const nothing = playable + (watchable ? 0 : feed.live.length + feed.broadcasts.length) === 0
  const filtered = Boolean(team || competition || watchable)
  const [liveTitle, upcomingTitle, highlightsTitle] = t.watch.sections
  const link = (overrides: Search) => {
    const merged = { sport, team: team || undefined, competition: competition || undefined, watchable: watchable ? "1" : undefined, ...overrides }
    const query = new URLSearchParams(Object.entries(merged).flatMap(([key, value]) => (value ? [[key, value]] : []))).toString()
    return href(query ? `/app/watch?${query}` : "/app/watch")
  }
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors", active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink")

  return (
    <AppPage>
      <PageHeader title={t.watch.title} lead={t.watch.lead} icon={<PlayCircle aria-hidden />} />

      <nav aria-label={t.watch.filter} className="fs-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={link({ sport: undefined, competition: undefined })} aria-current={!sport ? "page" : undefined} className={chip(!sport)}>{t.watch.allSports}</Link>
        {sports.map((item) => (
          <Link key={item.id} href={link({ sport: item.id, competition: undefined })} aria-current={sport === item.id ? "page" : undefined} className={chip(sport === item.id)}>
            <SportIcon id={item.id} className="size-4" /> {item.name[locale]}
          </Link>
        ))}
      </nav>

      <form role="search" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
        {sport && <input type="hidden" name="sport" value={sport} />}
        <div className="relative min-w-52 flex-1">
          <label htmlFor="watch-team" className="sr-only">{t.watch.team}</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input id="watch-team" type="search" name="team" defaultValue={team} placeholder={t.watch.team} className="fs-input h-10 pl-9 pr-3 text-sm" />
        </div>
        {(feed.competitions ?? []).length > 0 && (
          <>
            <label htmlFor="watch-competition" className="sr-only">{t.watch.competition}</label>
            <FilterSelect id="watch-competition" name="competition" value={competition} className="fs-input h-10 w-full px-2 text-sm sm:w-64">
              <option value="">{t.watch.allCompetitions}</option>
              {feed.competitions?.map((name) => <option key={name} value={name}>{name}</option>)}
            </FilterSelect>
          </>
        )}
        <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" name="watchable" value="1" defaultChecked={watchable} className="size-4 accent-[var(--fs-blue)]" /> {t.watch.watchableNow}
        </label>
        <button type="submit" className={btn("navy", "md")}>{t.watch.apply}</button>
        {filtered && <Link href={href(sport ? `/app/watch?sport=${sport}` : "/app/watch")} className={btn("ghost", "md")}>{t.watch.clear}</Link>}
      </form>

      {failed && <div className="mt-5"><ErrorNotice>{t.watch.failed}</ErrorNotice></div>}
      {!failed && feed.state === "stale" && (
        <Notice tone="warning" role="status" className="mt-5">
          {t.watch.stale}{feed.updatedAt && <> {t.watch.updated}: <LocalTime iso={feed.updatedAt} mode="datetime" /></>}
        </Notice>
      )}
      {watchable && !failed && <Notice role="note" className="mt-5">{t.watch.watchableNote}</Notice>}
      {nothing && !failed && (filtered
        ? <EmptyState className="mt-5" icon={<PlayCircle aria-hidden />} title={t.watch.noMatches} body={t.watch.noMatchesBody} action={{ href: href(sport ? `/app/watch?sport=${sport}` : "/app/watch"), label: t.watch.clear }} />
        : <EmptyState className="mt-5" icon={<PlayCircle aria-hidden />} title={t.watch.empty} body={t.watch.emptyBody} action={{ href: href("/app/scores"), label: t.watch.cta }} />)}

      {(!failed || playable > 0) && <section aria-labelledby="watch-highlights" className="mt-6">
        <h2 id="watch-highlights" className="flex items-center gap-2 text-[17px] font-semibold text-ink"><Clapperboard aria-hidden className="size-[18px] text-brand" /> {highlightsTitle}</h2>
        {playable === 0 ? <p className="mt-2 text-sm text-ink-2">{t.watch.noHighlights}</p> : (
          <ul className="fs-stagger mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {feed.highlights.map((item) => (
              <li key={item.matchId} className="min-w-0 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
                <HighlightPlayer matchId={item.matchId} title={item.title} thumbnailUrl={item.thumbnailUrl} channel={item.channel} />
                <Link href={href(`/app/match/${item.matchId}`)} className="mt-2 block font-semibold text-ink hover:underline">{item.title}</Link>
                <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
              </li>
            ))}
            {clips.map((item) => (
              <li key={item.id} className="min-w-0 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
                <HighlightPlayer clipId={item.id} title={item.title} thumbnailUrl={item.thumbnailUrl} />
                <p className="mt-2 font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
                {item.dateUTC && <p className="mt-0.5 text-xs text-ink-2"><LocalTime iso={item.dateUTC} mode="datetime" /></p>}
              </li>
            ))}
          </ul>
        )}
      </section>}

      {!failed && !watchable && <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <Panel title={liveTitle} icon={<Radio aria-hidden />} description={t.watch.liveNote}>
          {feed.live.length === 0 ? <p className="text-sm text-ink-2">{t.watch.noLive}</p> : (
            <div className="grid gap-3">{feed.live.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}</div>
          )}
        </Panel>
        <Panel title={upcomingTitle} icon={<CalendarClock aria-hidden />} description={t.watch.listingsNote}>
          {broadcasts.length === 0 ? <p className="text-sm text-ink-2">{t.watch.noListings}</p> : (
            <ul className="divide-y divide-line">
              {broadcasts.map((item) => {
                const row = (
                  <>
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
                      {item.logoUrl ? <img src={item.logoUrl} alt="" loading="lazy" decoding="async" className="size-full object-contain p-1" /> : <Tv aria-hidden className="size-4 text-ink-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{item.eventName}</span>
                      <span className="block truncate text-[13px] text-ink-2">{item.channel}{item.country ? ` · ${item.country}` : ""}</span>
                    </span>
                    {item.startUTC && <span className="shrink-0 text-xs text-ink-2"><LocalTime iso={item.startUTC} mode="datetime" /></span>}
                  </>
                )
                return <li key={item.id}>{item.matchId ? <Link href={href(`/app/match/${item.matchId}`)} className="flex items-center gap-3 py-2.5 hover:bg-surface-muted">{row}</Link> : <div className="flex items-center gap-3 py-2.5">{row}</div>}</li>
              })}
            </ul>
          )}
        </Panel>
      </div>}

      <Notice className="mt-6" role="note">{t.watch.disclaimer}</Notice>
    </AppPage>
  )
}
