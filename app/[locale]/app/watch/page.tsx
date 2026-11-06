import Link from "next/link"
import { headers } from "next/headers"
import { CalendarClock, Clapperboard, Film, PlayCircle, Radio, Search } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, btn, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { FilterSelect } from "@/components/sports/filter-select"
import { LocalTime } from "@/components/sports/parts"
import { NextGameLine } from "@/components/video/next-game"
import { ClipGrid, HighlightGrid, ListingList } from "@/components/video/watch-lists"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { enabledSports } from "@/lib/sports/service"
import { cn } from "@/lib/utils"
import type { WatchFilters } from "@/lib/video/catalog"
import { FACET_KEYS, SPORT_FACETS, type FacetChoice, type FacetKey } from "@/lib/video/facets"
import { loadWatchFeed } from "@/lib/video/load-feed"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.watch.title)

function viewerCountry(code: string | null): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null
  } catch {
    return null
  }
}

type Search = FacetChoice & { sport?: string; q?: string; watchable?: string }

export default async function WatchPage({ params, searchParams }: LocaleParams & { searchParams: Promise<Search> }) {
  const { t, href, locale } = await pageContext(params)
  const search = await searchParams
  const sports = enabledSports()
  const sport = sports.find((item) => item.id === search.sport)?.id
  const allowed: FacetKey[] = sport ? SPORT_FACETS[sport] : ["competition"]
  const choice: FacetChoice = Object.fromEntries(FACET_KEYS.flatMap((key) => (allowed.includes(key) && search[key] ? [[key, search[key].slice(0, 120)]] : [])))
  const q = (search.q ?? "").trim().slice(0, 80)
  const watchable = search.watchable === "1"
  const filters: WatchFilters = { ...choice, q: q || undefined, watchable: watchable || undefined }
  const { feed, failed, withheld } = await loadWatchFeed(sport, filters)
  if (withheld) return <MemberDataPending />
  const country = viewerCountry((await headers()).get("cloudfront-viewer-country"))
  const broadcasts = [...feed.broadcasts].sort((a, b) => Number(b.country === country) - Number(a.country === country))
  const clips = feed.clips ?? []
  const playable = feed.highlights.length + clips.length
  const nothing = playable + (watchable ? 0 : feed.live.length + feed.broadcasts.length) === 0
  const filtered = Boolean(q || watchable || Object.keys(choice).length > 0)
  const [liveTitle, upcomingTitle, highlightsTitle] = t.watch.sections
  const labels = sport ? t.watch.bySport[sport] : { live: liveTitle, listings: upcomingTitle, highlights: highlightsTitle }
  const sportName = sports.find((item) => item.id === sport)?.name[locale].toLocaleLowerCase(locale) ?? ""
  const named = (text: string) => text.replace("{sport}", sportName)
  const home = href(sport ? `/app/watch?sport=${sport}` : "/app/watch")
  const link = (next: string | undefined) => {
    const merged = { sport: next, q: q || undefined, watchable: watchable ? "1" : undefined }
    const query = new URLSearchParams(Object.entries(merged).flatMap(([key, value]) => (value ? [[key, value]] : []))).toString()
    return href(query ? `/app/watch?${query}` : "/app/watch")
  }
  const optionName = (key: FacetKey, value: string) => (key === "session" && value === "Race" ? t.watch.facets.race : value)
  const chip = (active: boolean) => cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors", active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink")

  return (
    <AppPage>
      <PageHeader title={t.watch.title} lead={t.watch.lead} icon={<PlayCircle aria-hidden />} />

      <nav aria-label={t.watch.filter} className="fs-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={link(undefined)} aria-current={!sport ? "page" : undefined} className={chip(!sport)}>{t.watch.allSports}</Link>
        {sports.map((item) => (
          <Link key={item.id} href={link(item.id)} aria-current={sport === item.id ? "page" : undefined} className={chip(sport === item.id)}>
            <SportIcon id={item.id} className="size-4" /> {item.name[locale]}
          </Link>
        ))}
      </nav>

      <form role="search" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
        {sport && <input type="hidden" name="sport" value={sport} />}
        <div className="relative min-w-52 flex-1">
          <label htmlFor="watch-search" className="sr-only">{t.watch.search}</label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input id="watch-search" type="search" name="q" defaultValue={q} placeholder={t.watch.search} className="fs-input h-10 pl-9 pr-3 text-sm" />
        </div>
        {(feed.facets ?? []).map(({ key, options }) => (
          <div key={key} className="w-full sm:w-52">
            <label htmlFor={`watch-${key}`} className="sr-only">{t.watch.facets[key]}</label>
            <FilterSelect id={`watch-${key}`} name={key} value={choice[key] ?? ""} className="fs-input h-10 w-full px-2 text-sm">
              <option value="">{t.watch.facetsAll[key]}</option>
              {options.map((name) => <option key={name} value={name}>{optionName(key, name)}</option>)}
            </FilterSelect>
          </div>
        ))}
        <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" name="watchable" value="1" defaultChecked={watchable} className="size-4 accent-[var(--fs-blue)]" /> {t.watch.watchableNow}
        </label>
        <button type="submit" className={btn("navy", "md")}>{t.watch.apply}</button>
        {filtered && <Link href={home} className={btn("ghost", "md")}>{t.watch.clear}</Link>}
      </form>

      {failed && <div className="mt-5"><ErrorNotice>{t.watch.failed}</ErrorNotice></div>}
      {!failed && feed.state === "stale" && (
        <Notice tone="warning" role="status" className="mt-5">
          {t.watch.stale}{feed.updatedAt && <> {t.watch.updated}: <LocalTime iso={feed.updatedAt} mode="datetime" /></>}
        </Notice>
      )}
      {watchable && !failed && <Notice role="note" className="mt-5">{t.watch.watchableNote}</Notice>}
      {nothing && !failed && (filtered
        ? <EmptyState className="mt-5" icon={<PlayCircle aria-hidden />} title={t.watch.noMatches} body={t.watch.noMatchesBody} action={{ href: home, label: t.watch.clear }} />
        : sport
          ? <EmptyState className="mt-5" icon={<PlayCircle aria-hidden />} title={named(t.watch.noSportVideo)} body={named(t.watch.noSportVideoBody)} action={{ href: href(`/app/scores?sport=${sport}`), label: t.watch.cta }}><NextGameLine game={feed.nextGame} none={named(t.watch.noNextGame)} t={t} locale={locale} href={href} /></EmptyState>
          : <EmptyState className="mt-5" icon={<PlayCircle aria-hidden />} title={t.watch.empty} body={t.watch.emptyBody} action={{ href: href("/app/scores"), label: t.watch.cta }} />)}

      {(!failed || playable > 0) && !(nothing && sport) && <section aria-labelledby="watch-highlights" className="mt-6">
        <h2 id="watch-highlights" className="flex items-center gap-2 text-[17px] font-semibold text-ink"><Clapperboard aria-hidden className="size-[18px] text-brand" /> {labels.highlights}</h2>
        {feed.highlights.length > 0 ? <HighlightGrid highlights={feed.highlights} href={href} /> : (
          clips.length === 0 && (
            <div className="mt-2">
              <p className="text-sm text-ink-2">{sport ? named(t.watch.noSportHighlights) : t.watch.noHighlights}</p>
              {sport && !filtered && <NextGameLine game={feed.nextGame} none={named(t.watch.noNextGame)} t={t} locale={locale} href={href} />}
            </div>
          )
        )}
      </section>}

      {clips.length > 0 && <section aria-labelledby="watch-clips" className="mt-6">
        <h2 id="watch-clips" className="flex items-center gap-2 text-[17px] font-semibold text-ink"><Film aria-hidden className="size-[18px] text-brand" /> {t.watch.clips}</h2>
        <ClipGrid clips={clips} />
      </section>}

      {!failed && !watchable && !(nothing && sport) && <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <Panel title={labels.live} icon={<Radio aria-hidden />} description={t.watch.liveNote}>
          {feed.live.length === 0 ? <p className="text-sm text-ink-2">{sport ? named(t.watch.noSportLive) : t.watch.noLive}</p> : (
            <div className="grid gap-3">{feed.live.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}</div>
          )}
        </Panel>
        <Panel title={labels.listings} icon={<CalendarClock aria-hidden />} description={t.watch.listingsNote}>
          {broadcasts.length === 0 ? <p className="text-sm text-ink-2">{sport ? named(t.watch.noSportListings) : t.watch.noListings}</p> : <ListingList broadcasts={broadcasts} href={href} />}
        </Panel>
      </div>}

      <Notice className="mt-6" role="note">{t.watch.disclaimer}</Notice>
    </AppPage>
  )
}
