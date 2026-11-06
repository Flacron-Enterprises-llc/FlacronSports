import Link from "next/link"
import { headers } from "next/headers"
import { CalendarClock, Clapperboard, History, PlayCircle, Radio, Tv } from "lucide-react"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { LocalTime } from "@/components/sports/parts"
import { HighlightPlayer } from "@/components/video/highlight-player"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { enabledSports, fromBackend } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { getWatchFeed, type WatchFeed } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.watch.title)

const EMPTY: WatchFeed = { live: [], highlights: [], clips: [], broadcasts: [] }

async function loadFeed(sport?: SportId): Promise<WatchFeed> {
  const query = sport ? `?sport=${sport}` : ""
  const feed = process.env.API_ORIGIN ? fromBackend<WatchFeed>(`/api/watch${query}`) : getWatchFeed(sport)
  return (await feed.catch(() => null)) ?? EMPTY
}

function viewerCountry(code: string | null): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null
  } catch {
    return null
  }
}

export default async function WatchPage({ params, searchParams }: LocaleParams & { searchParams: Promise<{ sport?: string }> }) {
  const { t, href, locale } = await pageContext(params)
  const { sport: requested } = await searchParams
  const sports = enabledSports()
  const sport = sports.find((item) => item.id === requested)?.id
  const feed = await loadFeed(sport)
  const country = viewerCountry((await headers()).get("cloudfront-viewer-country"))
  const broadcasts = [...feed.broadcasts].sort((a, b) => Number(b.country === country) - Number(a.country === country))
  const clips = feed.clips ?? []
  const nothing = feed.live.length + feed.highlights.length + clips.length + feed.broadcasts.length === 0
  const [liveTitle, upcomingTitle, highlightsTitle, replaysTitle] = t.watch.sections
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors", active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink")

  return (
    <AppPage>
      <PageHeader title={t.watch.title} lead={t.watch.lead} icon={<PlayCircle aria-hidden />} />

      <nav aria-label={t.watch.filter} className="fs-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={href("/app/watch")} aria-current={!sport ? "page" : undefined} className={chip(!sport)}>{t.watch.allSports}</Link>
        {sports.map((item) => (
          <Link key={item.id} href={href(`/app/watch?sport=${item.id}`)} aria-current={sport === item.id ? "page" : undefined} className={chip(sport === item.id)}>
            <SportIcon id={item.id} className="size-4" /> {item.name[locale]}
          </Link>
        ))}
      </nav>

      {nothing && <EmptyState className="mt-5" icon={<PlayCircle aria-hidden />} title={t.watch.empty} body={t.watch.emptyBody} action={{ href: href("/app/scores"), label: t.watch.cta }} />}

      <section aria-labelledby="watch-highlights" className="mt-6">
        <h2 id="watch-highlights" className="flex items-center gap-2 text-[17px] font-semibold text-ink"><Clapperboard aria-hidden className="size-[18px] text-brand" /> {highlightsTitle}</h2>
        {feed.highlights.length + clips.length === 0 ? <p className="mt-2 text-sm text-ink-2">{t.watch.noHighlights}</p> : (
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
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
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
      </div>

      <Panel className="mt-5" title={replaysTitle} icon={<History aria-hidden />}><p className="text-sm text-ink-2">{t.watch.noReplays}</p></Panel>
      <Notice className="mt-6" role="note">{t.watch.disclaimer}</Notice>
    </AppPage>
  )
}
