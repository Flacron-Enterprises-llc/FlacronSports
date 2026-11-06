"use client"

import { useState } from "react"
import { ExternalLink, LoaderCircle, Play } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { btn } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"

/**
 * Loads nothing from the video provider until the viewer presses play.
 * Clip thumbnails are frames of the video and can show the score, so spoiler mode hides them.
 */
export function HighlightPlayer({ matchId, clipId, title, thumbnailUrl, channel }: { matchId?: string; clipId?: string; title: string; thumbnailUrl?: string | null; channel?: string }) {
  const { t } = useLocale()
  const { prefs } = usePreferences()
  const [state, setState] = useState<"idle" | "checking" | "gone">("idle")
  const [video, setVideo] = useState<{ embedUrl: string; youtubeId?: string } | null>(null)

  const play = async () => {
    setState("checking")
    const query = clipId ? `clip=${encodeURIComponent(clipId)}` : `match=${encodeURIComponent(matchId ?? "")}`
    const response = await fetch(`/api/watch/play?${query}`).catch(() => null)
    const body = response?.ok ? ((await response.json().catch(() => null)) as { video: { embedUrl: string; youtubeId?: string } | null } | null) : null
    if (!body?.video) return setState("gone")
    setVideo(body.video)
    setState("idle")
  }

  if (video) {
    return (
      <div>
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
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
          <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-hot-text hover:underline">
            <ExternalLink aria-hidden className="size-3.5" /> {t.watch.openOnYoutube}<span className="sr-only"> {t.footer.newTab}</span>
          </a>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-navy">
        {thumbnailUrl && !prefs.lowData && !(clipId && prefs.spoilerMode) && <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-80" />}
        <div className="absolute inset-0 flex items-center justify-center">
          <button type="button" onClick={play} disabled={state === "checking"} aria-label={`${t.watch.playHighlights}: ${title}`} className={btn("navy", "md", "shadow-lg")}>
            {state === "checking" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />}
            {t.watch.playHighlights}
          </button>
        </div>
      </div>
      {channel && <p className="mt-2 text-xs text-ink-2">{t.watch.from.replace("{channel}", channel)}</p>}
      {prefs.spoilerMode && <p className="mt-1 text-xs text-ink-2">{t.watch.spoilerNote}</p>}
      {state === "gone" && <p role="alert" className="mt-1 text-sm text-bad">{t.watch.gone}</p>}
    </div>
  )
}
