"use client"

import { Children, useState } from "react"
import { chipClass } from "@/components/site/states"
import { SpoilerGuard } from "@/components/sports/parts"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import type { ClipVideo } from "@/lib/video/scorebat"
import { HighlightPlayer } from "./highlight-player"

/**
 * One game's player, with its other videos as choices. Goal titles state the score and the full
 * match view shows the result, so both wait behind the spoiler control.
 */
export function ClipPlayer({ leadId, videos, title, thumbnailUrl, flush, children }: { leadId: string; videos: ClipVideo[]; title: string; thumbnailUrl?: string | null; flush?: boolean; children?: React.ReactNode }) {
  const { t } = useLocale()
  const [active, setActive] = useState(leadId)
  const parts = videos.filter((video) => video.kind === "highlight")
  const streams = videos.filter((video) => video.kind === "live")
  const goals = videos.filter((video) => video.kind === "goal")
  const page = videos.find((video) => video.kind === "match")
  const current = videos.find((video) => video.id === active)

  const choice = (video: ClipVideo, label: string) => (
    <button key={video.id} type="button" aria-pressed={active === video.id} onClick={() => setActive(video.id)} className={chipClass(active === video.id, "max-w-full")}>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
  const hasChoices = parts.length + streams.length + goals.length + (page ? 1 : 0) > 1

  return (
    <div>
      <HighlightPlayer key={active} flush={flush} clipId={active} title={title} thumbnailUrl={active === leadId ? thumbnailUrl : null} live={current?.kind === "live"} autoStart={active !== leadId} />
      {children}
      {hasChoices && (
        <div className={cn("mt-2.5 space-y-2", flush && "px-3")}>
          {parts.length + streams.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {streams.map((video) => choice(video, t.watch.liveStream))}
              {parts.map((video, index) => choice(video, t.watch.highlightsPart.replace("{n}", String(index + 1))))}
            </div>
          )}
          {goals.length > 0 && (
            <SpoilerGuard label={t.watch.showGoals}>
              <p className="text-xs font-semibold text-ink-2">{t.watch.goalsGroup}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{goals.map((video) => choice(video, video.label))}</div>
            </SpoilerGuard>
          )}
          {page && <SpoilerGuard label={t.watch.showMatchView}><div className="flex flex-wrap gap-1.5">{choice(page, t.watch.matchView)}</div></SpoilerGuard>}
        </div>
      )}
    </div>
  )
}

/** A week of games is a long page, and the live games and TV listings sit below it. */
export function ShowMore({ first, label, className, children }: { first: number; label?: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const items = Children.toArray(children)
  const cut = Boolean(label) && !open && items.length > first
  return (
    <>
      <ul className={className}>{cut ? items.slice(0, first) : items}</ul>
      {cut && <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-hot-text underline-offset-2 hover:underline">{(label as string).replace("{count}", String(items.length))}</button>}
    </>
  )
}
