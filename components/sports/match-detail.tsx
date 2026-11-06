"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Activity, ArrowLeftRight, CircleDot, Flag, ListChecks, ShieldAlert, Square, Users } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { labelStats, labelTimeline, type LineupPlayer, type MatchDetail, type StatRow, type TimelineItem } from "@/lib/sports/detail"
import type { ScoreBreakdown, ScoreSegment, SportEvent } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { FavoriteStar, SpoilerGuard, SpoilerReveal } from "./parts"
import { PlayerLink } from "./player-link"

const LIVE_REFRESH_MS = 60_000

interface DetailState {
  detail: MatchDetail | null
  failed: boolean
  load(): Promise<void>
  /** A tab that needs the data asks for it, so a visit that stays on Overview spends no calls. */
  request(): void
}

const DetailContext = createContext<DetailState | null>(null)

/** Lives above the tabs, because a tab unmounts when another one opens. */
export function MatchDetailProvider({ matchId, live, children }: { matchId: string; live: boolean; children: React.ReactNode }) {
  const { prefs } = usePreferences()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [wanted, setWanted] = useState(false)

  const load = useCallback(async () => {
    const response = await authFetch(`/api/matches/${encodeURIComponent(matchId)}/detail`).catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFailed(false)
    setDetail(await response.json())
  }, [matchId])

  useEffect(() => {
    if (!wanted) return
    void load()
    if (!live || prefs.lowData) return
    const timer = setInterval(() => void load(), LIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [live, load, prefs.lowData, wanted])

  const request = useRef(() => setWanted(true)).current
  const value = useMemo(() => ({ detail, failed, load, request }), [detail, failed, load, request])
  return <DetailContext.Provider value={value}>{children}</DetailContext.Provider>
}

function useDetail() {
  const value = useContext(DetailContext)
  if (!value) throw new Error("useDetail needs a MatchDetailProvider")
  useEffect(() => value.request(), [value])
  return value
}

function KindIcon({ kind }: { kind: TimelineItem["kind"] }) {
  const size = "size-4 shrink-0"
  if (kind === "yellow") return <Square aria-hidden className={cn(size, "fill-amber-400 text-amber-400")} />
  if (kind === "red") return <Square aria-hidden className={cn(size, "fill-red-600 text-red-600")} />
  if (kind === "substitution") return <ArrowLeftRight aria-hidden className={cn(size, "text-ink-3")} />
  if (kind === "var") return <ShieldAlert aria-hidden className={cn(size, "text-ink-3")} />
  if (kind === "other" || kind === "missed-penalty") return <Flag aria-hidden className={cn(size, "text-ink-3")} />
  return <CircleDot aria-hidden className={cn(size, "text-hot-text")} />
}

function Timeline({ items }: { items: (TimelineItem & { label: string })[] }) {
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => {
        return (
          <li key={item.id} className={cn("flex items-center gap-3 py-2 text-sm", item.side === "away" && "sm:flex-row-reverse sm:text-right")}>
            <span className="tabular w-9 shrink-0 font-semibold text-ink">{item.minute === null ? "" : `${item.minute}′`}</span>
            <KindIcon kind={item.kind} />
            <span className="min-w-0">
              <span className="block font-medium text-ink">{item.player ?? item.label}</span>
              <span className="block text-xs text-ink-2">{item.label}{item.secondary ? ` · ${item.secondary}` : ""}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Null when either side is missing or not a number, so a bar never implies a value nobody supplied. */
const share = (home: string | null, away: string | null) => {
  if (home === null || away === null) return null
  const left = Number.parseFloat(home)
  const right = Number.parseFloat(away)
  const total = left + right
  return Number.isFinite(total) && total > 0 ? (left / total) * 100 : null
}

function StatValue({ value }: { value: string | null }) {
  const { t } = useLocale()
  if (value !== null) return <span className="tabular font-semibold text-ink">{value}</span>
  return <span className="text-ink-3"><span aria-hidden>–</span><span className="sr-only">{t.match.notAvailable}</span></span>
}

function Stats({ rows, home, away }: { rows: (StatRow & { label: string })[]; home: string; away: string }) {
  return (
    <div>
      <div className="mb-3 flex justify-between gap-3 text-xs font-semibold text-ink-2">
        <span className="min-w-0 truncate">{home}</span>
        <span className="min-w-0 truncate text-right">{away}</span>
      </div>
      <dl className="space-y-3">
        {rows.map((row) => {
          const width = share(row.home, row.away)
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <StatValue value={row.home} />
                <dt className="min-w-0 text-center text-xs text-ink-2">{row.label}</dt>
                <StatValue value={row.away} />
              </div>
              {width !== null && (
                <dd aria-hidden className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <span className="bg-navy dark:bg-brand" style={{ width: `${width}%` }} />
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function SegmentCell({ value }: { value: number | null }) {
  const { t } = useLocale()
  return <td className="tabular px-2 py-2 text-center font-semibold text-ink">{value ?? <><span aria-hidden>–</span><span className="sr-only">{t.match.notAvailable}</span></>}</td>
}

function Breakdown({ breakdown, home, away }: { breakdown: ScoreBreakdown; home: string; away: string }) {
  const { t, locale } = useLocale()
  const { segments, hits, errors } = breakdown
  const overtimes = segments.filter((item) => item.kind === "overtime").length
  const heading = (item: ScoreSegment) => {
    const template = item.kind === "overtime" ? (overtimes > 1 ? t.match.segments.overtimeNumbered : t.match.segments.overtime) : t.match.segments[item.kind]
    return template.replace("{n}", String(item.number))
  }
  const totals: StatRow[] = [
    ...(hits ? [{ key: "hits", home: String(hits.home), away: String(hits.away) }] : []),
    ...(errors ? [{ key: "errors", home: String(errors.home), away: String(errors.away) }] : []),
  ]
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">{t.match.byPeriod}</caption>
          <thead>
            <tr className="bg-surface-muted text-xs text-ink-2">
              <th scope="col" className="px-3 py-2 text-left font-medium">{t.event.name}</th>
              {segments.map((item) => <th key={`${item.kind}-${item.number}`} scope="col" className="whitespace-nowrap px-2 py-2 text-center font-medium">{heading(item)}</th>)}
            </tr>
          </thead>
          <tbody>
            {[{ name: home, side: "home" as const }, { name: away, side: "away" as const }].map(({ name, side }) => (
              <tr key={side} className="border-t border-line">
                <th scope="row" className="max-w-40 truncate px-3 py-2 text-left font-semibold text-ink">{name}</th>
                {segments.map((item) => <SegmentCell key={`${item.kind}-${item.number}`} value={item[side]} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totals.length > 0 && <Stats rows={labelStats(totals, t.match.stats, locale)} home={home} away={away} />}
    </div>
  )
}

function Squad({ title, players }: { title: string; players: LineupPlayer[] }) {
  const { t } = useLocale()
  const row = (player: LineupPlayer) => (
    <li key={player.id} className="flex items-center gap-2 py-1 text-sm">
      <span className="tabular w-6 shrink-0 text-right text-xs text-ink-3">{player.number ?? ""}</span>
      <PlayerLink id={player.playerId} name={player.name} className="min-w-0 flex-1 truncate text-ink" />
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

function Waiting() {
  const { t } = useLocale()
  return <Panel><div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div></Panel>
}

function Empty({ title, icon, children }: { title: string; icon: React.ReactNode; children: string }) {
  return <Panel title={title} icon={icon}><p className="text-sm leading-6 text-ink-2">{children}</p></Panel>
}

/** Updates state the result, so they stay behind the spoiler reveal. */
export function LiveUpdatesTab() {
  const { t, locale } = useLocale()
  const { detail, failed, load } = useDetail()
  if (failed && !detail) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!detail) return <Waiting />
  if (detail.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  const timeline = labelTimeline(detail.timeline, t.match.timelineKinds, locale)
  if (timeline.length === 0) return <Empty title={t.match.liveUpdates} icon={<ListChecks aria-hidden />}>{t.match.noUpdates}</Empty>
  return (
    <div className="space-y-4">
      <SpoilerReveal label={t.match.revealDetails} />
      <SpoilerGuard label={t.match.revealDetails} quiet><Panel title={t.match.liveUpdates} icon={<ListChecks aria-hidden />}><Timeline items={timeline} /></Panel></SpoilerGuard>
    </div>
  )
}

/** Period scores come with the event itself, so they show even when the detail feed fails. */
export function StatisticsTab({ home, away, breakdown }: { home: string; away: string; breakdown?: ScoreBreakdown }) {
  const { t, locale } = useLocale()
  const { detail, failed, load } = useDetail()
  const stats = labelStats(detail?.stats ?? [], t.match.stats, locale)
  const icon = <Activity aria-hidden />
  if (!breakdown && failed && !detail) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!breakdown && !detail) return <Waiting />
  if (!breakdown && detail?.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!breakdown && stats.length === 0) return <Empty title={t.match.statistics} icon={icon}>{t.match.noStatistics}</Empty>
  return (
    <div className="space-y-4">
      <SpoilerReveal label={t.match.revealDetails} />
      <SpoilerGuard label={t.match.revealDetails} quiet>
        <div className="space-y-4">
          {breakdown && <Panel title={t.match.byPeriod} icon={icon}><Breakdown breakdown={breakdown} home={home} away={away} /></Panel>}
          {stats.length > 0 && <Panel title={t.match.statistics} icon={icon}><Stats rows={stats} home={home} away={away} /></Panel>}
        </div>
      </SpoilerGuard>
    </div>
  )
}

/** A lineup states no result, so it stays visible in spoiler mode. */
export function LineupsTab({ home, away }: { home: string; away: string }) {
  const { t } = useLocale()
  const { detail, failed, load } = useDetail()
  if (failed && !detail) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!detail) return <Waiting />
  if (detail.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (detail.lineups.home.length === 0 && detail.lineups.away.length === 0) return <Empty title={t.match.participants} icon={<Users aria-hidden />}>{t.match.noParticipants}</Empty>
  return (
    <Panel title={t.match.lineups} icon={<Users aria-hidden />}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Squad title={home} players={detail.lineups.home} />
        <Squad title={away} players={detail.lineups.away} />
      </div>
    </Panel>
  )
}

/** Athletes and entrants. A classified field is sorted by name, since its own order is the result. */
export function EntrantsTab({ event }: { event: Pick<SportEvent, "participants" | "score"> }) {
  const { t } = useLocale()
  const { score, participants } = event
  const classified = score.kind === "classification"
  const rows = classified ? score.entries.map((entry) => ({ name: entry.name, team: entry.team })) : participants.map((item) => ({ name: item.name, team: null }))
  if (rows.length === 0) return <Empty title={t.match.participants} icon={<Users aria-hidden />}>{t.match.noParticipants}</Empty>
  const list = (
    <Panel title={t.match.participants} icon={<Users aria-hidden />}>
      <ul className="divide-y divide-line">
        {[...rows].sort((a, b) => (classified ? a.name.localeCompare(b.name) : 0)).map((row) => (
          <li key={row.name} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
            {row.team && <span className="min-w-0 truncate text-ink-2">{row.team}</span>}
            <FavoriteStar team={row.name} />
          </li>
        ))}
      </ul>
    </Panel>
  )
  return classified ? <SpoilerGuard label={t.spoiler.revealResult}>{list}</SpoilerGuard> : list
}
