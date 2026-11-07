"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { RankBadge, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import { PREDICTION_SPORTS } from "@/lib/community/pick-rules"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { BadgeList } from "./badge-list"

interface Entry {
  rank: number
  displayName: string
  points: number
  badges?: Badge[]
}

export function Leaderboard() {
  const { t, locale } = useLocale()
  const [sport, setSport] = useState<SportId | "">("")
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const asked = ++latest.current
    setFailed(false)
    setEntries(null)
    const response = await authFetch(`/api/predictions/leaderboard${sport ? `?sport=${sport}` : ""}`).catch(() => null)
    const data = response?.ok ? ((await response.json()) as { entries: Entry[] }) : null
    if (asked !== latest.current) return
    if (data) setEntries(data.entries ?? [])
    else setFailed(true)
  }, [sport])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">{t.community.leaderboardSport}</span>
        <select data-testid="leaderboard-sport" className="fs-input h-10 px-3 text-sm" value={sport} onChange={(event) => setSport(event.target.value as SportId | "")}>
          <option value="">{t.scores.allSports}</option>
          {SPORTS.filter(({ id }) => PREDICTION_SPORTS.includes(id)).map(({ id, name }) => <option key={id} value={id}>{name[locale]}</option>)}
        </select>
      </label>
      {failed && <ErrorNotice onRetry={load}>{t.ui.leaderboardFailed}</ErrorNotice>}
      {!failed && !entries && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>}
      {entries?.length === 0 && <p className="text-sm text-ink-2">{sport ? t.community.noSportPoints : t.community.noPoints}</p>}
      {entries && entries.length > 0 && (
        <ol className="-my-1 divide-y divide-line text-sm">
          {entries.map((entry, index) => (
            <li key={index} className="flex min-h-11 items-center gap-2.5 py-1">
              <RankBadge rank={entry.rank} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{entry.displayName} <BadgeList badges={entry.badges} /></span>
              <span className="tabular shrink-0 font-display font-semibold text-ink">{entry.points}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
