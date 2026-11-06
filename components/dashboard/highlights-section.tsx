"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clapperboard } from "lucide-react"
import { CardGridSkeleton } from "@/components/site/states"
import { HighlightPlayer } from "@/components/video/highlight-player"
import { useLocale } from "@/lib/use-locale"
import type { WatchFeed } from "@/lib/video/catalog"
import { ErrorNotice } from "./controls"

const SHOWN = 4

/** Loaded after the scores, so a slow video check never holds up the dashboard. */
export function HighlightsSection() {
  const { t, href } = useLocale()
  const copy = t.discover
  const [feed, setFeed] = useState<Pick<WatchFeed, "highlights" | "clips"> | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await fetch("/api/watch").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFeed(await response.json())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const highlights = feed?.highlights.slice(0, SHOWN) ?? []
  const clips = (feed?.clips ?? []).slice(0, Math.max(0, SHOWN - highlights.length))

  return (
    <section aria-label={copy.highlightsTitle} className="min-w-0">
      <div className="flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink"><Clapperboard aria-hidden className="size-[18px] text-brand" /> {copy.highlightsTitle}</h2>
        <Link href={href("/app/watch")} className="inline-flex items-center gap-1 text-sm font-semibold text-hot-text hover:underline">{t.dash.viewAll}<ArrowRight aria-hidden className="size-3.5" /></Link>
      </div>
      <div className="mt-3">
        {failed && <ErrorNotice onRetry={load}>{copy.highlightsFailed}</ErrorNotice>}
        {!failed && !feed && <div role="status" aria-label={t.ui.loading}><CardGridSkeleton count={2} /></div>}
        {feed && highlights.length + clips.length === 0 && <p className="text-sm text-ink-2">{copy.highlightsEmpty}</p>}
        {highlights.length + clips.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {highlights.map((item) => (
              <li key={item.matchId} className="min-w-0 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
                <HighlightPlayer matchId={item.matchId} title={item.title} thumbnailUrl={item.thumbnailUrl} channel={item.channel} />
                <Link href={href(`/app/match/${item.matchId}`)} className="mt-2 block truncate font-semibold text-ink hover:underline">{item.title}</Link>
                <p className="truncate text-xs text-ink-2">{item.competition}</p>
              </li>
            ))}
            {clips.map((clip) => (
              <li key={clip.id} className="min-w-0 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
                <HighlightPlayer clipId={clip.id} title={clip.title} thumbnailUrl={clip.thumbnailUrl} />
                <p className="mt-2 truncate font-semibold text-ink">{clip.title}</p>
                <p className="truncate text-xs text-ink-2">{clip.competition}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
