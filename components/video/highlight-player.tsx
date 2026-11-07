"use client"

import { useState } from "react"
import { ExternalLink, LoaderCircle, Play } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

/**
 * Loads nothing from the video provider until the viewer presses play.
 * Clip thumbnails are frames of the video and can show the score, so spoiler mode hides them.
 */
export function HighlightPlayer({ matchId, clipId, title, thumbnailUrl, channel, flush }: { matchId?: string; clipId?: string; title: string; thumbnailUrl?: string | null; channel?: string; flush?: boolean }) {
  const { t } = useLocale()
  const { prefs } = usePreferences()
  const [state, setState] = useState<"idle" | "checking" | "gone">("idle")
  const [video, setVideo] = useState<{ embedUrl: string; youtubeId?: string } | null>(null)

  const play = async () => {
    setState("checking")
    const query = clipId ? `clip=${encodeURIComponent(clipId)}` : `match=${encodeURIComponent(matchId ?? "")}`
    const response = await authFetch(`/api/watch/play?${query}`).catch(() => null)
    const body = response?.ok ? ((await response.json().catch(() => null)) as { video: { embedUrl: string; youtubeId?: string } | null } | null) : null
    if (!body?.video) return setState("gone")
    setVideo(body.video)
    setState("idle")
  }

  if (video) {
    return (
      <div>
        <div className={cn("aspect-video overflow-hidden bg-black", !flush && "rounded-lg")}>
          <iframe
            src={video.embedUrl}
            title={title}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full"
          />
        </div>
        {video.youtubeId && (
          <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer" className={cn("mt-2 inline-flex min-h-8 items-center gap-1.5 text-[13px] font-semibold text-hot-text hover:underline", flush && "px-3")}>
            <ExternalLink aria-hidden className="size-3.5" /> {t.watch.openOnYoutube}<span className="sr-only"> {t.footer.newTab}</span>
          </a>
        )}
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={play} disabled={state === "checking"} aria-label={`${t.watch.playHighlights}: ${title}`} className={cn("fs-thumb", !flush && "rounded-lg")}>
        {thumbnailUrl && !prefs.lowData && !(clipId && prefs.spoilerMode)
          ? <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
          : <span aria-hidden className="fs-band absolute inset-0"><span className="fs-grid absolute inset-0 opacity-70" /></span>}
        <span className="absolute inset-0 z-[1] flex items-center justify-center">
          <span className="fs-play inline-flex size-14 items-center justify-center rounded-full bg-orange text-hot-on">
            {state === "checking" ? <LoaderCircle aria-hidden className="size-6 animate-spin" /> : <Play aria-hidden className="ml-0.5 size-6 fill-current" />}
          </span>
        </span>
      </button>
      {(channel || prefs.spoilerMode || state === "gone") && (
        <div className={cn("mt-2", flush && "px-3")}>
          {channel && <p className="truncate text-xs text-ink-2">{t.watch.from.replace("{channel}", channel)}</p>}
          {prefs.spoilerMode && <p className="mt-1 text-xs text-ink-2">{t.watch.spoilerNote}</p>}
          {state === "gone" && <p role="alert" className="mt-1 text-sm text-bad">{t.watch.gone}</p>}
        </div>
      )}
    </div>
  )
}
