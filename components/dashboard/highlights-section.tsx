"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clapperboard } from "lucide-react"
import { SectionHeading, VideoGridSkeleton } from "@/components/site/states"
import { HighlightPlayer } from "@/components/video/highlight-player"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"
import type { WatchFeed } from "@/lib/video/catalog"
import { ErrorNotice } from "./controls"

const SHOWN = 4
const TILE = "fs-tile fs-lift min-w-0 overflow-hidden rounded-xl border border-line bg-surface pb-3 shadow-[var(--shadow-sm)]"

/** Loaded after the scores, so a slow video check never holds up the dashboard. */
export function HighlightsSection() {
  const { t, href } = useLocale()
  const copy = t.discover
  const [feed, setFeed] = useState<Pick<WatchFeed, "highlights" | "clips"> | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/watch").catch(() => null)
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
      <SectionHeading title={copy.highlightsTitle} icon={<Clapperboard aria-hidden />} action={<Link href={href("/app/watch")} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-hot-text hover:underline sm:min-h-8">{t.dash.viewAll}<ArrowRight aria-hidden className="size-3.5" /></Link>} />
      <div className="mt-2">
        {failed && <ErrorNotice onRetry={load}>{copy.highlightsFailed}</ErrorNotice>}
        {!failed && !feed && <div role="status" aria-label={t.ui.loading}><VideoGridSkeleton /></div>}
        {feed && highlights.length + clips.length === 0 && <p className="text-sm text-ink-2">{copy.highlightsEmpty}</p>}
        {highlights.length + clips.length > 0 && (
          <ul className="fs-settle grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {highlights.map((item) => (
              <li key={item.matchId} className={TILE}>
                <HighlightPlayer flush matchId={item.matchId} title={item.title} thumbnailUrl={item.thumbnailUrl} channel={item.channel} />
                <div className="px-3">
                  <Link href={href(`/app/match/${item.matchId}`)} className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-ink underline-offset-2 hover:underline">{item.title}</Link>
                  <p className="truncate text-xs text-ink-2">{item.competition}</p>
                </div>
              </li>
            ))}
            {clips.map((clip) => (
              <li key={clip.id} className={TILE}>
                <HighlightPlayer flush clipId={clip.id} title={clip.title} thumbnailUrl={clip.thumbnailUrl} />
                <div className="px-3 pt-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink">{clip.title}</p>
                  <p className="truncate text-xs text-ink-2">{clip.competition}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
