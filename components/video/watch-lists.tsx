import Link from "next/link"
import { Radio } from "lucide-react"
import { SportIcon } from "@/components/site/sport-icon"
import { LocalTime } from "@/components/sports/parts"
import { ChannelLogo } from "@/components/video/channel-logo"
import { ClipPlayer, ShowMore } from "@/components/video/clip-player"
import { HighlightPlayer } from "@/components/video/highlight-player"
import type { Broadcast } from "@/lib/sports/service"
import type { Highlight, LiveStream } from "@/lib/video/catalog"
import { groupListings } from "@/lib/video/listings"
import type { Clip } from "@/lib/video/scorebat"
import { cn } from "@/lib/utils"

type Href = (path: string) => string

const CARD = "fs-tile fs-lift min-w-0 overflow-hidden rounded-xl border border-line bg-surface pb-3 shadow-[var(--shadow-sm)]"
// The first two tiles run larger. On a shorter list every tile is already large.
const GRID = "fs-settle mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-6 xl:[&>li]:col-span-2 xl:[&>li:nth-child(-n+2)]:col-span-3"
const GRID_EVEN = "fs-settle mt-3 grid gap-4 sm:grid-cols-2"
const CLIPS_FIRST = 12

export function HighlightGrid({ highlights, href, even }: { highlights: Omit<Highlight, "youtubeId">[]; href: Href; even?: boolean }) {
  return (
    <ul className={even ? GRID_EVEN : GRID}>
      {highlights.map((item) => (
        <li key={item.matchId} className={CARD}>
          <HighlightPlayer flush matchId={item.matchId} title={item.title} thumbnailUrl={item.thumbnailUrl} channel={item.channel} />
          <div className="px-3">
            <Link href={href(`/app/match/${item.matchId}`)} className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-5 text-ink underline-offset-2 hover:underline">{item.title}</Link>
            <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

const clipTitle = "mt-0.5 line-clamp-2 text-[15px] font-semibold leading-5 text-ink underline-offset-2 hover:underline"

/** Each game once, with its goals grouped under it. A clip tied to a game links to that game. */
export function ClipGrid({ clips, href, even, moreLabel }: { clips: Clip[]; href: Href; even?: boolean; moreLabel?: string }) {
  return (
    <ShowMore first={CLIPS_FIRST} label={moreLabel} className={even ? GRID_EVEN : GRID}>
      {clips.map((item) => (
        <li key={item.id} className={CARD}>
          <ClipPlayer flush leadId={item.id} videos={item.videos ?? []} title={item.title} thumbnailUrl={item.thumbnailUrl}>
            <div className="px-3 pt-2">
              {item.matchId ? <Link href={href(`/app/match/${item.matchId}`)} className={cn("block", clipTitle)}>{item.title}</Link> : <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink">{item.title}</p>}
              <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
              {item.dateUTC && <p className="mt-0.5 text-xs text-ink-2"><LocalTime iso={item.dateUTC} mode="datetime" /></p>}
            </div>
          </ClipPlayer>
        </li>
      ))}
    </ShowMore>
  )
}

/** Streams the video feed lists for a game on now. The note says no more than that. */
export function StreamGrid({ streams, href, label }: { streams: LiveStream[]; href: Href; label: string }) {
  return (
    <ul className={GRID_EVEN}>
      {streams.map((item) => (
        <li key={item.id} className={CARD}>
          <HighlightPlayer flush live clipId={item.id} title={item.title} thumbnailUrl={item.thumbnailUrl} />
          <div className="px-3 pt-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-live"><Radio aria-hidden className="size-3.5" /> {label}</p>
            {item.matchId ? <Link href={href(`/app/match/${item.matchId}`)} className={cn("block", clipTitle)}>{item.title}</Link> : <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-5 text-ink">{item.title}</p>}
            <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** One card for each game, with its channels as chips. The feed lists one row per channel. */
export function ListingList({ broadcasts, href, className }: { broadcasts: Broadcast[]; href: Href; className?: string }) {
  return (
    <ul className={cn("fs-settle grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {groupListings(broadcasts).map((game) => (
        <li key={game.key} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-sm)]">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-2">
            <SportIcon id={game.sportId} className="size-3.5 shrink-0" />
            {game.startUTC && <LocalTime iso={game.startUTC} mode="datetime" />}
          </p>
          {game.matchId
            ? <Link href={href(`/app/match/${game.matchId}`)} className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-ink underline-offset-2 hover:underline">{game.eventName}</Link>
            : <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-ink">{game.eventName}</p>}
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {game.channels.map((item) => (
              <li key={item.id} className="flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line py-0.5 pl-1 pr-2.5 text-xs text-ink">
                <ChannelLogo url={item.logoUrl} className="size-6 rounded-full border border-line" />
                <span className="min-w-0 truncate"><span className="font-medium">{item.channel}</span>{item.country && <span className="text-ink-2"> {item.country}</span>}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
