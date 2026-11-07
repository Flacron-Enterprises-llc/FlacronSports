"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Activity, ArrowLeftRight, CircleDot, Flag, ListChecks, ShieldAlert, Square, Users } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { labelStats, labelTimeline, type LineupPlayer, type MatchDetail, type StatRow, type TimelineItem } from "@/lib/sports/detail"
import { lineScore } from "@/lib/sports/adapters/line-score"
import type { SportEvent, SportId } from "@/lib/sports/types"
import type { Dictionary } from "@/lib/i18n"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { FavoriteStar, SpoilerGuard, SpoilerReveal } from "./parts"
import { PeriodScore } from "./period-score"
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
  if (kind === "other" || kind === "missed-penalty" || kind === "infraction") return <Flag aria-hidden className={cn(size, "text-ink-3")} />
  return <CircleDot aria-hidden className={cn(size, "text-hot-text")} />
}

/** Hockey's minutes restart each period, so the period is part of the time. */
function periodShort(code: string, t: Dictionary): string {
  if (code === "POT") return t.match.segmentsShort.overtime
  return t.match.segmentsShort.period.replace("{n}", code.replace(/^P/, ""))
}

/** Home reads from the left of the centre line and away from the right. A phone keeps one column. */
function Timeline({ items }: { items: (TimelineItem & { label: string })[] }) {
  const { t } = useLocale()
  return (
    <ol className="relative sm:before:absolute sm:before:inset-y-0 sm:before:left-1/2 sm:before:w-px sm:before:bg-line">
      {items.map((item) => {
        const away = item.side === "away"
        return (
          <li key={item.id} className="relative grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2.5 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:gap-x-2">
            <div className="flex justify-start sm:col-start-2 sm:row-start-1 sm:justify-center">
              <span className="tabular whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-ink">{item.period ? `${periodShort(item.period, t)} ` : ""}{item.minute === null ? "" : `${item.minute}′`}</span>
            </div>
            <div className={cn("flex min-w-0 items-center gap-2.5 sm:row-start-1", away ? "sm:col-start-3" : "sm:col-start-1 sm:flex-row-reverse sm:text-right")}>
              <KindIcon kind={item.kind} />
              <span className="min-w-0">
                <span className="block break-words font-medium text-ink">{item.player ?? item.label}</span>
                <span className="block break-words text-xs text-ink-2">{item.label}{item.secondary ? ` · ${item.secondary}` : ""}</span>
              </span>
            </div>
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

function StatValue({ value, lead }: { value: string | null; lead?: boolean }) {
  const { t } = useLocale()
  if (value !== null) return <span className={cn("tabular text-[15px]", lead ? "font-bold text-ink" : "font-medium text-ink-2")}>{value}</span>
  return <span className="text-ink-3"><span aria-hidden>–</span><span className="sr-only">{t.match.notAvailable}</span></span>
}

/** Each side's bar grows from its own edge. The colours match the two names above them. */
function Stats({ rows, home, away }: { rows: (StatRow & { label: string })[]; home: string; away: string }) {
  return (
    <div>
      <div className="mb-4 flex justify-between gap-3 text-[13px] font-semibold text-ink">
        <span className="flex min-w-0 items-center gap-1.5"><span aria-hidden className="fs-bar-home size-2.5 shrink-0 rounded-full" /><span className="min-w-0 truncate">{home}</span></span>
        <span className="flex min-w-0 items-center gap-1.5"><span className="min-w-0 truncate text-right">{away}</span><span aria-hidden className="fs-bar-away size-2.5 shrink-0 rounded-full" /></span>
      </div>
      <dl className="space-y-3.5">
        {rows.map((row) => {
          const width = share(row.home, row.away)
          const left = Number.parseFloat(row.home ?? "")
          const right = Number.parseFloat(row.away ?? "")
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <StatValue value={row.home} lead={left > right} />
                <dt className="min-w-0 text-center text-[13px] text-ink-2">{row.label}</dt>
                <StatValue value={row.away} lead={right > left} />
              </div>
              {width !== null && (
                <dd aria-hidden className="mt-1.5 flex h-2 gap-1">
                  <span className="fs-bar-home fs-bar-grow rounded-full" style={{ width: `${width}%` }} />
                  <span className="fs-bar-away fs-bar-grow min-w-0 flex-1 rounded-full" style={{ ["--from" as string]: "right" }} />
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function Squad({ title, players }: { title: string; players: LineupPlayer[] }) {
  const { t } = useLocale()
  const row = (player: LineupPlayer) => (
    <li key={player.id} className="fs-row flex min-h-10 items-center gap-2.5 px-3 py-1 text-sm">
      <span className="tabular inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-surface-muted px-1 text-xs font-semibold text-ink-2">{player.number ?? ""}</span>
      <PlayerLink id={player.playerId} name={player.name} className="min-w-0 flex-1 truncate font-medium text-ink" />
      {player.group && <span className="shrink-0 text-xs font-medium text-ink-2">{t.match.positions[player.group]}</span>}
      {player.role && <span className="shrink-0 text-xs font-medium text-ink-2">{t.match.basketballPositions[player.role]}</span>}
    </li>
  )
  const bench = players.filter((player) => player.substitute)
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-line">
      <h3 className="fs-foot truncate border-b border-line px-3 py-2 text-sm font-semibold text-ink">{title}</h3>
      <ul className="divide-y divide-line">{players.filter((player) => !player.substitute).map(row)}</ul>
      {bench.length > 0 && (
        <>
          <p className="fs-foot border-y border-line px-3 py-1.5 text-xs font-semibold text-ink-2">{t.match.substitutes}</p>
          <ul className="divide-y divide-line">{bench.map(row)}</ul>
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
export function LiveUpdatesTab({ extra, sportId }: { extra?: React.ReactNode; sportId?: SportId }) {
  const { t, locale } = useLocale()
  const { detail, failed, load } = useDetail()
  if (!extra && failed && !detail) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!extra && !detail) return <Waiting />
  if (!extra && detail?.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  const timeline = labelTimeline(detail?.timeline ?? [], t.match.timelineKinds, locale, { infractions: t.match.infractions, situations: t.match.goalSituations })
  if (timeline.length === 0 && !extra) return <Empty title={t.match.liveUpdates} icon={<ListChecks aria-hidden />}>{(sportId && t.match.sportNotes[sportId]?.updates) || t.match.noUpdates}</Empty>
  return (
    <div className="space-y-4">
      <SpoilerReveal label={t.match.revealDetails} />
      <SpoilerGuard label={t.match.revealDetails} quiet>
        <div className="space-y-4">
          {timeline.length > 0 && <Panel title={t.match.liveUpdates} icon={<ListChecks aria-hidden />}><Timeline items={timeline} /></Panel>}
          {extra}
        </div>
      </SpoilerGuard>
    </div>
  )
}

/** Period scores come with the event itself, so they show even when the detail feed fails. Hockey's come with the detail. */
export function StatisticsTab({ home, away, event, extra }: { home: string; away: string; event: SportEvent; extra?: React.ReactNode }) {
  const { t, locale } = useLocale()
  const { detail, failed, load } = useDetail()
  const stats = labelStats(detail?.stats ?? [], t.match.stats, locale)
  const icon = <Activity aria-hidden />
  const scored = { ...event, breakdown: event.breakdown ?? detail?.breakdown }
  const table = lineScore(scored, t)
  const ownData = table || extra
  if (!ownData && failed && !detail) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!ownData && !detail) return <Waiting />
  if (!ownData && detail?.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!ownData && stats.length === 0) return <Empty title={t.match.statistics} icon={icon}>{t.match.sportNotes[event.sportId]?.statistics ?? t.match.noStatistics}</Empty>
  return (
    <div className="space-y-4">
      <SpoilerReveal label={t.match.revealDetails} />
      <SpoilerGuard label={t.match.revealDetails} quiet>
        <div className="space-y-4">
          {extra}
          {table && <Panel title={table.caption} icon={icon}><PeriodScore event={scored} t={t} /></Panel>}
          {stats.length > 0 && <Panel title={t.match.statistics} icon={icon}><Stats rows={stats} home={home} away={away} /></Panel>}
        </div>
      </SpoilerGuard>
    </div>
  )
}

/** A lineup states no result, so it stays visible in spoiler mode. */
export function LineupsTab({ home, away, sportId }: { home: string; away: string; sportId?: SportId }) {
  const { t } = useLocale()
  const { detail, failed, load } = useDetail()
  if (failed && !detail) return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (!detail) return <Waiting />
  if (detail.state === "unavailable") return <ErrorNotice onRetry={load}>{t.match.detailFailed}</ErrorNotice>
  if (detail.lineups.home.length === 0 && detail.lineups.away.length === 0) {
    return (
      <Panel title={t.match.teams} icon={<Users aria-hidden />}>
        <p data-testid="no-lineups" className="text-sm leading-6 text-ink-2">{(sportId && t.match.sportNotes[sportId]?.lineups) || t.match.noLineups}</p>
        <ul className="mt-3 grid gap-2 text-sm font-medium text-ink sm:grid-cols-2">
          {[home, away].filter((name) => name && name !== "TBD").map((name) => <li key={name} className="min-w-0 truncate rounded-lg bg-surface-muted px-3 py-2.5">{name}</li>)}
        </ul>
      </Panel>
    )
  }
  return (
    <Panel title={t.match.lineups} icon={<Users aria-hidden />}>
      <div className="grid gap-3 sm:grid-cols-2">
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
  const rows = classified ? score.entries.map((entry) => ({ name: entry.name, team: entry.team, id: entry.playerId })) : participants.map((item) => ({ name: item.name, team: null, id: item.id }))
  if (rows.length === 0) return <Empty title={t.match.participants} icon={<Users aria-hidden />}>{t.match.noParticipants}</Empty>
  const list = (
    <Panel flush title={t.match.participants} icon={<Users aria-hidden />}>
      <ul className="divide-y divide-line sm:grid sm:grid-cols-2 sm:divide-y-0">
        {[...rows].sort((a, b) => (classified ? a.name.localeCompare(b.name) : 0)).map((row) => (
          <li key={row.name} className="fs-row flex min-h-11 items-center gap-2 px-4 py-1 text-sm sm:px-5">
            <span className="min-w-0 flex-1">
              <PlayerLink id={row.id} name={row.name} className="block truncate font-medium text-ink" />
              {row.team && <span className="block truncate text-xs text-ink-2">{row.team}</span>}
            </span>
            <FavoriteStar team={row.name} />
          </li>
        ))}
      </ul>
    </Panel>
  )
  return classified ? <SpoilerGuard label={t.spoiler.revealResult}>{list}</SpoilerGuard> : list
}
