import Link from "next/link"
import { Tv } from "lucide-react"
import { LocalTime } from "@/components/sports/parts"
import { HighlightPlayer } from "@/components/video/highlight-player"
import type { Broadcast } from "@/lib/sports/service"
import type { Highlight } from "@/lib/video/catalog"
import type { Clip } from "@/lib/video/scorebat"

type Href = (path: string) => string

const CARD = "min-w-0 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]"
const GRID = "fs-stagger mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"

export function HighlightGrid({ highlights, href }: { highlights: Omit<Highlight, "youtubeId">[]; href: Href }) {
  return (
    <ul className={GRID}>
      {highlights.map((item) => (
        <li key={item.matchId} className={CARD}>
          <HighlightPlayer matchId={item.matchId} title={item.title} thumbnailUrl={item.thumbnailUrl} channel={item.channel} />
          <Link href={href(`/app/match/${item.matchId}`)} className="mt-2 block font-semibold text-ink hover:underline">{item.title}</Link>
          <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
        </li>
      ))}
    </ul>
  )
}

export function ClipGrid({ clips }: { clips: Clip[] }) {
  return (
    <ul className={GRID}>
      {clips.map((item) => (
        <li key={item.id} className={CARD}>
          <HighlightPlayer clipId={item.id} title={item.title} thumbnailUrl={item.thumbnailUrl} />
          <p className="mt-2 font-semibold text-ink">{item.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-2">{item.competition}</p>
          {item.dateUTC && <p className="mt-0.5 text-xs text-ink-2"><LocalTime iso={item.dateUTC} mode="datetime" /></p>}
        </li>
      ))}
    </ul>
  )
}

export function ListingList({ broadcasts, href }: { broadcasts: Broadcast[]; href: Href }) {
  return (
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
  )
}
