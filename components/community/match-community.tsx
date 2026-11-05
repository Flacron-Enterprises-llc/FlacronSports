"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { MessageList } from "./message-list"

interface Entry {
  rank: number
  displayName: string
  points: number
}

const FIELD = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"

function Predictions({ matchId, predictable, home, away }: { matchId: string; predictable: boolean; home: string; away: string }) {
  const { t } = useLocale()
  const user = useAuthUser()
  const [homeScore, setHomeScore] = useState("")
  const [awayScore, setAwayScore] = useState("")
  const [mine, setMine] = useState<{ home: number; away: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    authFetch(`/api/predictions?matchId=${matchId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setMine(data?.prediction ?? null))
      .catch(() => undefined)
  }, [user, matchId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const response = await authFetch("/api/predictions", {
      method: "POST",
      body: JSON.stringify({ matchId, home: Number(homeScore), away: Number(awayScore) }),
    }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (response?.ok) setMine(data.prediction)
    else setNotice(data?.code === "prediction_locked" ? t.community.predictionLocked : data?.code === "duplicate_prediction" ? t.community.predictionDuplicate : t.community.sendFailed)
  }

  return (
    <div>
      <h3 className="font-semibold text-ink">{t.community.predictions}</h3>
      <p className="mt-1 text-sm leading-6 text-ink-2">{t.community.predictionRules}</p>
      {mine && <p className="mt-2 text-sm font-semibold text-ink">{t.community.yourPrediction} {mine.home} - {mine.away}</p>}
      {!mine && user && predictable && (
        <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-ink">{home}<input className={FIELD} type="number" min={0} max={300} required value={homeScore} onChange={(e) => setHomeScore(e.target.value)} /></label>
          <label className="text-sm font-medium text-ink">{away}<input className={FIELD} type="number" min={0} max={300} required value={awayScore} onChange={(e) => setAwayScore(e.target.value)} /></label>
          <button type="submit" className="col-span-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.community.predict}</button>
        </form>
      )}
      {!mine && !predictable && <p className="mt-2 text-sm text-ink-2">{t.community.predictionLocked}</p>}
      {notice && <p role="status" className="mt-2 text-sm text-ink">{notice}</p>}
    </div>
  )
}

function Leaderboard() {
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

export function MatchCommunity({ matchId, predictable, home, away }: { matchId: string; predictable: boolean; home: string; away: string }) {
  const { t, href } = useLocale()
  return (
    <section aria-label={t.community.title} className="mt-5 space-y-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-ink">{t.community.title}</h2>
      <Predictions matchId={matchId} predictable={predictable} home={home} away={away} />
      <Leaderboard />
      <Link href={href(`/app/rooms?match=${matchId}`)} className="block text-sm font-semibold text-hot-text hover:underline">{t.community.rooms}</Link>
      <div>
        <h3 className="mb-2 font-semibold text-ink">{t.community.chat}</h3>
        <MessageList scope="match" scopeId={matchId} path={`/api/matches/${matchId}/chat`} />
      </div>
    </section>
  )
}
