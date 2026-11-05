"use client"

import { useEffect, useState } from "react"
import { useLocale } from "@/lib/use-locale"

interface Entry {
  rank: number
  displayName: string
  points: number
}

export function Leaderboard() {
  const { t } = useLocale()
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    fetch("/api/predictions/leaderboard")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setEntries(data?.entries ?? []))
      .catch(() => setEntries([]))
  }, [])

  return (
    <div>
      <h3 className="font-semibold text-ink">{t.community.leaderboard}</h3>
      {entries?.length === 0 && <p className="mt-1 text-sm text-ink-2">{t.community.noPoints}</p>}
      <ol className="mt-2 space-y-1 text-sm text-ink-2">
        {entries?.map((entry, index) => <li key={index}>{entry.rank}. {entry.displayName} · {entry.points}</li>)}
      </ol>
    </div>
  )
}
