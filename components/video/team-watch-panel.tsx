import Link from "next/link"
import { ArrowRight, Clapperboard } from "lucide-react"
import { EventCard } from "@/components/sports/event-card"
import { Panel } from "@/components/site/states"
import { ClipGrid, HighlightGrid, ListingList } from "@/components/video/watch-lists"
import type { Dictionary } from "@/lib/i18n"
import { eventTitle } from "@/lib/sports/presentation"
import type { SportEvent, SportId } from "@/lib/sports/types"
import type { Highlight, WatchFeed } from "@/lib/video/catalog"

const LISTING_LIMIT = 6

/** Nothing renders without real video, a live game or a listing. Older games come from the team's own results. */
export function TeamWatchPanel({ sport, team, recent, feed, t, href }: { sport: SportId; team: string; recent: { event: SportEvent; channel: string }[]; feed: WatchFeed | null; t: Dictionary; href: (path: string) => string }) {
  const held = feed?.highlights ?? []
  const known = new Set(held.map((item) => item.matchId))
  const older: Omit<Highlight, "youtubeId">[] = recent.filter(({ event }) => !known.has(event.id)).map(({ event, channel }) => ({
    channel, matchId: event.id, title: eventTitle(event), competition: event.competition.name, sportId: event.sportId, thumbnailUrl: event.thumbnailUrl ?? null, dateUTC: event.scheduledStartUTC,
  }))
  const highlights = [...held, ...older]
  const clips = feed?.clips ?? []
  const live = feed?.live ?? []
  const listings = (feed?.broadcasts ?? []).slice(0, LISTING_LIMIT)
  if (highlights.length + clips.length + live.length + listings.length === 0) return null

  const copy = t.watch.bySport[sport]
  const onWatch = held.length + clips.length + live.length + listings.length > 0
  const more = onWatch ? <Link href={href(`/app/watch?${new URLSearchParams({ sport, team })}`)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-hot-text hover:underline">{t.watch.teamMore}<ArrowRight aria-hidden className="size-3.5" /></Link> : undefined

  return (
    <Panel className="mb-7" title={t.watch.teamPanel} icon={<Clapperboard aria-hidden />} actions={more}>
      <div className="space-y-5">
        {live.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">{copy.live}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{live.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}</div>
          </div>
        )}
        {highlights.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">{copy.highlights}</h3>
            <HighlightGrid highlights={highlights} href={href} />
          </div>
        )}
        {clips.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">{t.watch.clips}</h3>
            <ClipGrid clips={clips} />
          </div>
        )}
        {listings.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">{copy.listings}</h3>
            <ListingList broadcasts={listings} href={href} />
          </div>
        )}
      </div>
    </Panel>
  )
}
