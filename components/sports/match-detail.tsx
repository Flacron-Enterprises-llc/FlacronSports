"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, ArrowLeftRight, CircleDot, ListChecks, ShieldAlert, Square, Users } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Panel, Skeleton } from "@/components/site/states"
import type { LineupPlayer, MatchDetail, StatRow, TimelineItem } from "@/lib/sports/detail"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { SpoilerGuard, SpoilerReveal, SpoilerScope } from "./parts"

const LIVE_REFRESH_MS = 60_000

function KindIcon({ kind }: { kind: TimelineItem["kind"] }) {
  const size = "size-4 shrink-0"
  if (kind === "yellow") return <Square aria-hidden className={cn(size, "fill-amber-400 text-amber-400")} />
  if (kind === "red") return <Square aria-hidden className={cn(size, "fill-red-600 text-red-600")} />
  if (kind === "substitution") return <ArrowLeftRight aria-hidden className={cn(size, "text-ink-3")} />
  if (kind === "var") return <ShieldAlert aria-hidden className={cn(size, "text-ink-3")} />
  return <CircleDot aria-hidden className={cn(size, "text-hot-text")} />
}

function Timeline({ items }: { items: TimelineItem[] }) {
  const { t } = useLocale()
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className={cn("flex items-center gap-3 py-2 text-sm", item.side === "away" && "sm:flex-row-reverse sm:text-right")}>
          <span className="tabular w-9 shrink-0 font-semibold text-ink">{item.minute === null ? "" : `${item.minute}′`}</span>
          <KindIcon kind={item.kind} />
          <span className="min-w-0">
            <span className="block font-medium text-ink">{item.player ?? t.match.timelineKinds[item.kind]}</span>
            <span className="block text-xs text-ink-2">
              {t.match.timelineKinds[item.kind]}{item.secondary ? ` · ${item.secondary}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

const share = (home: string, away: string) => {
  const left = Number.parseFloat(home)
  const right = Number.parseFloat(away)
  const total = left + right
  return Number.isFinite(total) && total > 0 ? (left / total) * 100 : 50
}

function Stats({ rows, home, away }: { rows: StatRow[]; home: string; away: string }) {
  const { t } = useLocale()
  return (
    <div>
      <div className="mb-3 flex justify-between gap-3 text-xs font-semibold text-ink-2">
        <span className="min-w-0 truncate">{home}</span>
        <span className="min-w-0 truncate text-right">{away}</span>
      </div>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="tabular font-semibold text-ink">{row.home}</span>
              <dt className="min-w-0 text-center text-xs text-ink-2">{(t.match.stats as Record<string, string>)[row.key]}</dt>
              <span className="tabular font-semibold text-ink">{row.away}</span>
            </div>
            <dd aria-hidden className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <span className="bg-navy dark:bg-brand" style={{ width: `${share(row.home, row.away)}%` }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Squad({ title, players }: { title: string; players: LineupPlayer[] }) {
  const { t } = useLocale()
  const row = (player: LineupPlayer) => (
    <li key={player.id} className="flex items-center gap-2 py-1 text-sm">
      <span className="tabular w-6 shrink-0 text-right text-xs text-ink-3">{player.number ?? ""}</span>
      <span className="min-w-0 flex-1 truncate text-ink">{player.name}</span>
      {player.group && <span className="shrink-0 text-[11px] font-semibold text-ink-3">{t.match.positions[player.group]}</span>}
    </li>
  )
  const bench = players.filter((player) => player.substitute)
  return (
    <div className="min-w-0">
      <h4 className="truncate text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-1">{players.filter((player) => !player.substitute).map(row)}</ul>
      {bench.length > 0 && (
        <>
          <p className="mt-2 text-xs font-semibold text-ink-2">{t.match.substitutes}</p>
          <ul className="mt-1">{bench.map(row)}</ul>
        </>
      )}
    </div>
  )
}

/** Timeline and statistics state the result, so they stay behind the spoiler reveal. A lineup does not. */
export function MatchDetailPanel({ matchId, home, away, live }: { matchId: string; home: string; away: string; live: boolean }) {
  const { t } = useLocale()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/detail`).catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFailed(false)
    setDetail(await response.json())
  }, [matchId])

  useEffect(() => {
    void load()
    if (!live) return
    const timer = setInterval(() => void load(), LIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [live, load])

  if (!detail && failed) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!detail) return <Panel><div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div></Panel>
  if (detail.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (detail.state === "empty") return <Panel title={t.match.details} icon={<Activity aria-hidden />}><p className="text-sm leading-6 text-ink-2">{t.match.detailEmpty}</p></Panel>

  const hasLineups = detail.lineups.home.length > 0 || detail.lineups.away.length > 0
  return (
    <div className="space-y-4">
      <SpoilerScope>
        {(detail.timeline.length > 0 || detail.stats.length > 0) && <SpoilerReveal label={t.match.revealDetails} />}
        {detail.timeline.length > 0 && <SpoilerGuard label={t.match.revealDetails} quiet><Panel title={t.match.timeline} icon={<ListChecks aria-hidden />}><Timeline items={detail.timeline} /></Panel></SpoilerGuard>}
        {detail.stats.length > 0 && <SpoilerGuard label={t.match.revealDetails} quiet><Panel className="mt-4" title={t.match.statistics} icon={<Activity aria-hidden />}><Stats rows={detail.stats} home={home} away={away} /></Panel></SpoilerGuard>}
      </SpoilerScope>
      {hasLineups && (
        <Panel title={t.match.lineups} icon={<Users aria-hidden />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Squad title={home} players={detail.lineups.home} />
            <Squad title={away} players={detail.lineups.away} />
          </div>
        </Panel>
      )}
    </div>
  )
}
