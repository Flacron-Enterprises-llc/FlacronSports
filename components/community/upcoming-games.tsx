"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarClock, Star } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, ListSkeleton, Notice, Panel } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import type { UpcomingGame } from "@/lib/community/upcoming"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

const PREDICT_LIST = 6
const PICKER_LIST = 30

function useUpcomingGames() {
  const [data, setData] = useState<{ games: UpcomingGame[]; stale: boolean } | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/me/upcoming").catch(() => null)
    if (response?.ok) setData(await response.json())
    else setFailed(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { data, failed, load }
}

function GameLine({ game }: { game: UpcomingGame }) {
  const { t } = useLocale()
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
        {game.followed && <Star role="img" aria-label={t.community.followedGame} className="size-3.5 shrink-0 fill-orange text-orange" />}
        <span className="min-w-0 truncate">{game.title}</span>
      </span>
      <span className="mt-0.5 block truncate text-xs text-ink-2">{game.competition} · <LocalTime iso={game.kickoffUTC} mode="datetime" /></span>
    </>
  )
}

/** Games still open to a pick, leaving out the ones the member has already predicted. */
export function UpcomingGames({ picked }: { picked: string[] }) {
  const { t, href } = useLocale()
  const { data, failed, load } = useUpcomingGames()
  const games = data?.games.filter((game) => game.predictable && !picked.includes(game.id)).slice(0, PREDICT_LIST)

  return (
    <Panel id="upcoming-games" title={t.community.upcomingTitle} description={t.community.upcomingLead} icon={<CalendarClock aria-hidden />}>
      {failed && !data && <ErrorNotice onRetry={load}>{t.community.upcomingFailed}</ErrorNotice>}
      {!data && !failed && <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={3} /></div>}
      {data?.stale && <p className="mb-2 text-xs text-ink-2">{t.feed.stale}</p>}
      {games?.length === 0 && <p className="text-sm text-ink-2">{t.community.noUpcoming}</p>}
      {games && games.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {games.map((game) => (
            <li key={game.id}>
              <Link href={href(`/app/match/${game.id}?tab=chat`)} data-testid="upcoming-game" className="block rounded-md py-2 hover:bg-surface-muted">
                <GameLine game={game} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={href("/app/scores?status=upcoming")} className={btn("ghost", "sm", "mt-3")}>{t.community.browseUpcoming}</Link>
    </Panel>
  )
}

const searchable = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** `presetMatch` is the game a member came from, which may fall outside the listed week. */
export function GamePicker({ value, onChange, presetMatch }: { value: string | null; onChange(id: string): void; presetMatch: string | null }) {
  const { t } = useLocale()
  const { data, failed, load } = useUpcomingGames()
  const [query, setQuery] = useState("")

  const games = useMemo(() => {
    const words = searchable(query).split(/\s+/).filter(Boolean)
    return (data?.games ?? []).filter((game) => words.every((word) => searchable(`${game.title} ${game.competition}`).includes(word))).slice(0, PICKER_LIST)
  }, [data, query])

  const presetListed = data?.games.some((game) => game.id === presetMatch)

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-ink">{t.community.pickGame}</legend>
      {presetMatch && data && !presetListed && (
        <label className="mt-2 flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="room-game" checked={value === presetMatch} onChange={() => onChange(presetMatch)} />
          {t.community.selectedGame}
        </label>
      )}
      <label className="mt-2 block">
        <span className="sr-only">{t.community.findGame}</span>
        <input type="search" data-testid="room-game-search" className="fs-input h-10 px-3 text-sm" placeholder={t.community.findGame} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {failed && !data && <div className="mt-2"><ErrorNotice onRetry={load}>{t.community.upcomingFailed}</ErrorNotice></div>}
      {!data && !failed && <div role="status" aria-label={t.ui.loading} className="mt-2"><ListSkeleton rows={3} /></div>}
      {data?.stale && <p className="mt-2 text-xs text-ink-2">{t.feed.stale}</p>}
      {data && games.length === 0 && <Notice className="mt-2" role="status">{query ? t.community.noGameMatch : t.community.noUpcoming}</Notice>}
      {games.length > 0 && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
          {games.map((game) => (
            <li key={game.id}>
              <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-2", value === game.id ? "border-orange" : "border-line hover:bg-surface-muted")}>
                <input type="radio" name="room-game" data-testid="room-game" className="mt-1" checked={value === game.id} onChange={() => onChange(game.id)} />
                <span className="min-w-0 flex-1"><GameLine game={game} /></span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
