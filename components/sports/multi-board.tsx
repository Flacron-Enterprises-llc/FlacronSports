"use client"

import { useCallback, useEffect, useState } from "react"
import { Pin, RefreshCw, Star } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { ErrorNotice, Segmented, useOnline } from "@/components/dashboard/controls"
import { btn, CardGridSkeleton, EmptyState, Notice } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import type { EventFeed, SportEvent } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"

const REFRESH_MS = 60_000

interface Board {
  pinned: SportEvent[]
  favorites: SportEvent[]
  missing: number
  state: EventFeed["state"]
  fetchedAt: string
}

export function MultiBoard() {
  const { t, href } = useLocale()
  const copy = t.discover
  const { prefs } = usePreferences()
  const online = useOnline()
  const [view, setView] = useState<"pinned" | "favorites">("pinned")
  const [board, setBoard] = useState<Board | null>(null)
  const [failed, setFailed] = useState(false)
  const pins = prefs.boardPins.join()

  const load = useCallback(async () => {
    const response = await authFetch("/api/me/board").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFailed(false)
    setBoard(await response.json())
  }, [])

  // Pinning from a card on this page changes the list, so it reloads with the pins.
  useEffect(() => {
    void load()
  }, [load, pins])

  useEffect(() => {
    if (prefs.lowData || !online) return
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load, online, prefs.lowData])

  const events = view === "pinned" ? board?.pinned : board?.favorites

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<"pinned" | "favorites"> value={view} onChange={setView} label={copy.boardTitle} options={[{ value: "pinned", label: copy.pinned }, { value: "favorites", label: copy.favoritesView }]} />
        <div className="flex items-center gap-3">
          {board && <span className="text-xs text-ink-2">{t.feed.updated}: <LocalTime iso={board.fetchedAt} /></span>}
          <button type="button" onClick={load} className={btn("outline", "sm")}><RefreshCw aria-hidden className="size-3.5" /> {copy.refresh}</button>
        </div>
      </div>

      {prefs.lowData && <p className="text-xs text-ink-3">{copy.boardLowData}</p>}
      {failed && <ErrorNotice onRetry={load}>{copy.boardFailed}</ErrorNotice>}
      {board?.state === "stale" && <Notice tone="warning" role="status">{t.feed.stale}</Notice>}
      {board?.state === "unavailable" && <ErrorNotice onRetry={load}>{t.feed.unavailable}</ErrorNotice>}
      {view === "pinned" && Boolean(board?.missing) && <Notice tone="warning" role="status">{copy.boardMissing.replace("{count}", String(board?.missing))}</Notice>}

      {!board && !failed && <div role="status" aria-label={t.ui.loading}><CardGridSkeleton count={3} /></div>}
      {events && events.length > 0 && (
        <div className="fs-settle grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
        </div>
      )}
      {events?.length === 0 && board?.state !== "unavailable" && !board?.missing && (
        view === "pinned"
          ? <EmptyState icon={<Pin aria-hidden />} title={copy.boardEmpty} body={copy.boardEmptyBody} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />
          : <EmptyState icon={<Star aria-hidden />} title={copy.favoritesEmpty} body={copy.favoritesEmptyBody} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />
      )}
    </div>
  )
}
