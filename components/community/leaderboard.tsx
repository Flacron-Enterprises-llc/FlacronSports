"use client"

import { useCallback, useEffect, useState } from "react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import { useLocale } from "@/lib/use-locale"
import { BadgeList } from "./badge-list"

interface Entry {
  rank: number
  displayName: string
  points: number
  badges?: Badge[]
}

export function Leaderboard() {
  const { t } = useLocale()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/predictions/leaderboard").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setEntries(((await response.json()) as { entries: Entry[] }).entries ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (failed) return <ErrorNotice onRetry={load}>{t.ui.leaderboardFailed}</ErrorNotice>
  if (!entries) return <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>
  if (entries.length === 0) return <p className="text-sm text-ink-2">{t.community.noPoints}</p>

  return (
    <ol className="divide-y divide-line text-sm">
      {entries.map((entry, index) => (
        <li key={index} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <span className="tabular w-6 shrink-0 text-right font-semibold text-ink-2">{entry.rank}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{entry.displayName} <BadgeList badges={entry.badges} /></span>
          <span className="tabular shrink-0 font-semibold text-ink">{entry.points}</span>
        </li>
      ))}
    </ol>
  )
}
