"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Medal, MessagesSquare, Users } from "lucide-react"
import { btn, Notice, Panel } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { pickWords, type PickFields } from "@/lib/community/pick-words"
import type { PredictionKind } from "@/lib/community/predictions"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { useCommunityGate } from "./community-gate"
import { Leaderboard } from "./leaderboard"
import { MessageList } from "./message-list"
import { RuleList } from "./rule-list"

/** The field is a name-sorted list, since a past finishing order is a result. */
function PodiumFields({ matchId, value, onChange, onUnavailable }: { matchId: string; value: string[]; onChange(next: string[]): void; onUnavailable(): void }) {
  const { t } = useLocale()
  const [entrants, setEntrants] = useState<string[] | null>(null)

  useEffect(() => {
    authFetch(`/api/predictions/entrants?matchId=${matchId}`)
      .then((response) => (response.ok ? response.json() : { entrants: [] }))
      .then((data) => {
        setEntrants(data.entrants)
        if (data.entrants.length < 3) onUnavailable()
      })
      .catch(onUnavailable)
  }, [matchId, onUnavailable])

  if (!entrants) return <p role="status" className="text-sm text-ink-2">{t.ui.loading}</p>
  if (entrants.length < 3) return null
  return (
    <>
      {t.community.podiumPlaces.map((place, index) => (
        <label key={place} className="block text-sm font-medium text-ink">
          {place}
          <select required className="fs-input mt-1 h-10 px-3 text-sm" value={value[index] ?? ""} onChange={(event) => onChange(value.map((name, at) => (at === index ? event.target.value : name)))}>
            <option value="" />
            {entrants.map((name) => <option key={name} value={name} disabled={value.includes(name) && value[index] !== name}>{name}</option>)}
          </select>
        </label>
      ))}
    </>
  )
}

function Predictions({ matchId, kind, predictable, home, away, combat }: { matchId: string; kind: PredictionKind; predictable: boolean; home: string; away: string; combat: boolean }) {
  const { t } = useLocale()
  const user = useAuthUser()
  const gate = useCommunityGate()
  const [homeScore, setHomeScore] = useState("")
  const [awayScore, setAwayScore] = useState("")
  const [podium, setPodium] = useState(["", "", ""])
  const [noField, setNoField] = useState(false)
  const [mine, setMine] = useState<PickFields | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const markNoField = useCallback(() => setNoField(true), [])

  useEffect(() => {
    if (!user) return
    authFetch(`/api/predictions?matchId=${matchId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setMine(data?.prediction ?? null))
      .catch(() => undefined)
  }, [user, matchId])

  const send = async (pick: object) => {
    setBusy(true)
    setNotice(null)
    const response = await authFetch("/api/predictions", { method: "POST", body: JSON.stringify({ matchId, ...pick }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    setBusy(false)
    if (response?.ok) setMine(data.prediction)
    else if (!gate.intercept(data?.code, () => send(pick))) setNotice(data?.code === "prediction_locked" ? t.community.predictionLocked : data?.code === "duplicate_prediction" ? t.community.predictionDuplicate : t.community.sendFailed)
  }

  const field = "fs-input mt-1 h-10 px-3 text-center font-display text-lg font-semibold"
  const submitted = (pick: object) => (event: FormEvent) => {
    event.preventDefault()
    void send(pick)
  }

  return (
    <div>
      {mine && <Notice tone="success" role="status">{t.community.yourPrediction} <span data-testid="own-prediction" className="tabular font-semibold text-ink">{pickWords(mine, { home, away }, t.community)}</span></Notice>}
      {!mine && user && predictable && gate.prompt}
      {!mine && user && predictable && !gate.locked && kind === "score" && (
        <form onSubmit={submitted({ home: Number(homeScore), away: Number(awayScore) })} className="grid grid-cols-2 gap-3">
          <label className="min-w-0 text-sm font-medium text-ink"><span className="block truncate">{home}</span><input className={field} type="number" min={0} max={300} required value={homeScore} onChange={(event) => setHomeScore(event.target.value)} /></label>
          <label className="min-w-0 text-sm font-medium text-ink"><span className="block truncate">{away}</span><input className={field} type="number" min={0} max={300} required value={awayScore} onChange={(event) => setAwayScore(event.target.value)} /></label>
          <button type="submit" disabled={busy} className={btn("primary", "md", "col-span-2")}>{t.community.predict}</button>
        </form>
      )}
      {!mine && user && predictable && !gate.locked && kind === "winner" && (
        <div role="group" aria-label={combat ? t.community.pickBout : t.community.pickWinner}>
          <p className="text-sm font-medium text-ink">{combat ? t.community.pickBout : t.community.pickWinner}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[home, away].map((name) => <button key={name} type="button" disabled={busy} className={btn("outline", "md", "min-w-0")} onClick={() => send({ winner: name })}><span className="truncate">{name}</span></button>)}
          </div>
        </div>
      )}
      {!mine && user && predictable && !gate.locked && kind === "podium" && !noField && (
        <form onSubmit={submitted({ podium })} className="space-y-3">
          <PodiumFields matchId={matchId} value={podium} onChange={setPodium} onUnavailable={markNoField} />
          <button type="submit" disabled={busy} className={btn("primary", "md", "w-full")}>{t.community.predict}</button>
        </form>
      )}
      {!mine && predictable && kind === "podium" && noField && <p className="text-sm text-ink-2">{t.community.podiumNoField}</p>}
      {!mine && !predictable && <p className="text-sm text-ink-2">{t.community.predictionLocked}</p>}
      {notice && <p role="status" className="mt-2 text-sm text-ink">{notice}</p>}
      <details className="mt-3 text-[13px] leading-5 text-ink-2">
        <summary className="cursor-pointer font-semibold hover:text-ink">{t.community.pointRules}</summary>
        <div className="mt-2"><RuleList /></div>
      </details>
    </div>
  )
}

export function MatchCommunity({ matchId, predictable, kind, combat = false, home, away }: { matchId: string; predictable: boolean; kind: PredictionKind | null; combat?: boolean; home: string; away: string }) {
  const { t, href } = useLocale()
  const title = kind === "podium" ? t.community.pickPodium : kind === "winner" ? t.community.pickTitle : t.community.predictions
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {kind && <Panel title={title} icon={<Medal aria-hidden />}><Predictions matchId={matchId} kind={kind} predictable={predictable} home={home} away={away} combat={combat} /></Panel>}
        <Panel title={t.community.leaderboard} icon={<Medal aria-hidden />}><Leaderboard /></Panel>
      </div>
      <Panel
        title={t.community.chat}
        icon={<MessagesSquare aria-hidden />}
        actions={<Link href={href(`/app/rooms?match=${matchId}`)} className={btn("outline", "sm")}><Users aria-hidden className="size-3.5" />{t.community.rooms}</Link>}
      >
        <MessageList scope="match" scopeId={matchId} path={`/api/matches/${matchId}/chat`} />
      </Panel>
    </div>
  )
}
