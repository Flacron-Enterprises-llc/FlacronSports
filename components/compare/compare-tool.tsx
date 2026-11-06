"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bookmark, GitCompareArrows, Lock, Trash2 } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { useAccount } from "@/components/dashboard/account-context"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, Panel, Skeleton } from "@/components/site/states"
import { LocalTime, SpoilerGuard, SpoilerReveal, SpoilerScope } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { hasPlusFeatures } from "@/lib/billing/plans"
import type { Comparison, SplitRecord, TeamProfile } from "@/lib/sports/compare"
import type { SportId } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

interface SavedView {
  id: string
  first: string
  second: string
  sport: SportId | null
  createdAt: string
}

const FORM_TONE = { W: "bg-good text-white", D: "bg-surface-muted text-ink-2", L: "bg-bad text-white" }
const average = (total: number, played: number) => (played ? (total / played).toFixed(1) : "–")

function Form({ team }: { team: TeamProfile }) {
  const { t } = useLocale()
  if (team.form.length === 0) return <span className="text-ink-3">–</span>
  return (
    <span className="inline-flex gap-1">
      {team.form.map((result, index) => (
        <span key={index} className={cn("inline-flex size-6 items-center justify-center rounded text-[11px] font-bold", FORM_TONE[result])} title={t.compare.results[result]}>
          {t.compare.letters[result]}
        </span>
      ))}
    </span>
  )
}

function Row({ label, first, second }: { label: string; first: React.ReactNode; second: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="py-2.5 pr-3 text-left text-sm font-medium text-ink-2">{label}</th>
      <td className="tabular py-2.5 pr-3 text-sm font-semibold text-ink">{first}</td>
      <td className="tabular py-2.5 text-sm font-semibold text-ink">{second}</td>
    </tr>
  )
}

function Results({ data }: { data: Comparison }) {
  const { t } = useLocale()
  const [one, two] = data.teams
  const line = (record: SplitRecord) => (record.played ? `${record.wins}-${record.draws}-${record.losses}` : "–")
  const both = (read: (team: TeamProfile) => React.ReactNode) => ({ first: read(one), second: read(two) })
  const advanced = (read: (figures: NonNullable<TeamProfile["advanced"]>) => React.ReactNode) => both((team) => (team.advanced ? read(team.advanced) : "–"))

  return (
    <Panel title={`${one.name} / ${two.name}`} description={t.compare.basis} icon={<GitCompareArrows aria-hidden />}>
      <SpoilerScope>
        <SpoilerReveal label={t.compare.reveal} />
        <SpoilerGuard label={t.compare.reveal} quiet>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <caption className="sr-only">{t.compare.title}</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th scope="col" className="py-2 pr-3 font-semibold">{t.compare.measure}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{one.name}</th>
                  <th scope="col" className="py-2 font-semibold">{two.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <Row label={t.compare.form} {...both((team) => <Form team={team} />)} />
                <Row label={t.compare.record} {...both((team) => line(team.record))} />
                <Row label={t.compare.scoredAverage} {...both((team) => average(team.record.scored, team.record.played))} />
                <Row label={t.compare.concededAverage} {...both((team) => average(team.record.conceded, team.record.played))} />
                {data.tier === "advanced" && (
                  <>
                    <Row label={t.compare.homeRecord} {...advanced((figures) => line(figures.home))} />
                    <Row label={t.compare.awayRecord} {...advanced((figures) => line(figures.away))} />
                    <Row label={t.compare.cleanSheets} {...advanced((figures) => figures.cleanSheets)} />
                    <Row label={t.compare.failedToScore} {...advanced((figures) => figures.failedToScore)} />
                    <Row label={t.compare.position} {...advanced((figures) => figures.standing?.rank ?? "–")} />
                    <Row label={t.compare.points} {...advanced((figures) => figures.standing?.points ?? "–")} />
                    <Row label={t.compare.goalDifference} {...advanced((figures) => figures.standing?.difference ?? "–")} />
                  </>
                )}
              </tbody>
            </table>
          </div>
          {data.tier === "advanced" && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-ink">{t.compare.headToHead}</h3>
              {data.headToHead.length === 0 && <p className="mt-1 text-sm text-ink-2">{t.compare.noHeadToHead}</p>}
              <ul className="mt-1 space-y-1 text-sm text-ink-2">
                {data.headToHead.map((game) => (
                  <li key={game.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{game.title}</span>
                    <span className="tabular shrink-0 font-semibold text-ink">{game.home}-{game.away}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SpoilerGuard>
      </SpoilerScope>
      <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
        {data.teams.map((team) => (
          <div key={team.name} className="min-w-0">
            <dt className="text-ink-2">{t.compare.nextGame}: {team.name}</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {team.next ? <Link href={`/app/match/${team.next.id}`} className="underline-offset-2 hover:underline">{team.next.title}</Link> : "–"}
              {team.next?.startUTC && <span className="block text-xs font-normal text-ink-2"><LocalTime iso={team.next.startUTC} mode="datetime" /></span>}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function TeamField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input id={id} list={`${id}-list`} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" maxLength={120} className="fs-input h-10 w-full px-3 text-sm" />
      <datalist id={`${id}-list`}>{options.map((name) => <option key={name} value={name} />)}</datalist>
    </div>
  )
}

export function CompareTool({ sports }: { sports: { id: SportId; name: string }[] }) {
  const { t, href } = useLocale()
  const { plan, loaded } = useAccount()
  const { prefs } = usePreferences()
  const [first, setFirst] = useState("")
  const [second, setSecond] = useState("")
  const [sport, setSport] = useState<SportId>("football")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [data, setData] = useState<Comparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadViews = useCallback(async () => {
    const response = await authFetch("/api/compare/saved").catch(() => null)
    if (response?.ok) setViews(((await response.json()) as { views: SavedView[] }).views)
  }, [])

  useEffect(() => {
    if (loaded) void loadViews()
  }, [loaded, loadViews])

  const suggest = (text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2) return
    timer.current = setTimeout(async () => {
      const response = await authFetch(`/api/teams/search?q=${encodeURIComponent(text.trim())}`).catch(() => null)
      if (response?.ok) setSuggestions(((await response.json()) as { teams: { name: string }[] }).teams.map((team) => team.name))
    }, 350)
  }

  const run = async (one = first, two = second, chosen: SportId | null = sport) => {
    setBusy(true)
    setError(null)
    setData(null)
    const query = new URLSearchParams({ first: one, second: two, ...(chosen ? { sport: chosen } : {}) })
    const response = await authFetch(`/api/compare?${query}`).catch(() => null)
    setBusy(false)
    if (response?.ok) return setData(await response.json())
    const body = (await response?.json().catch(() => null)) as { code?: string; team?: string } | null
    if (body?.code === "team_not_found") return setError(t.compare.notFound.replace("{team}", body.team ?? ""))
    setError(body?.code === "same_team" ? t.compare.sameTeam : t.compare.failed)
  }

  const save = async () => {
    const response = await authFetch("/api/compare/saved", { method: "POST", body: JSON.stringify({ first, second, sport }) }).catch(() => null)
    if (response?.ok) return loadViews()
    const body = (await response?.json().catch(() => null)) as { code?: string } | null
    setError(body?.code === "views_limit" ? t.compare.viewsLimit : t.compare.failed)
  }

  const remove = async (id: string) => {
    await authFetch(`/api/compare/saved?id=${id}`, { method: "DELETE" }).catch(() => null)
    await loadViews()
  }

  const open = (view: SavedView) => {
    setFirst(view.first)
    setSecond(view.second)
    if (view.sport) setSport(view.sport)
    void run(view.first, view.second, view.sport)
  }

  if (!loaded) return <Panel><Skeleton className="h-10 w-full" /></Panel>
  if (!hasPlusFeatures(plan)) {
    return (
      <Panel title={t.compare.lockedTitle} icon={<Lock aria-hidden />}>
        <p className="text-sm leading-6 text-ink-2">{t.compare.lockedBody}</p>
        <Link href={href("/app/billing#plans")} className={btn("navy", "md", "mt-3")}>{t.compare.upgrade}</Link>
      </Panel>
    )
  }

  const options = [...new Set([...suggestions, ...prefs.favorites])]
  return (
    <div className="space-y-4">
      <Panel>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run()
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="lg:w-44">
              <label htmlFor="compare-sport" className="mb-1 block text-sm font-medium text-ink">{t.compare.sport}</label>
              <select id="compare-sport" value={sport} onChange={(event) => setSport(event.target.value as SportId)} className="fs-input h-10 w-full px-2 text-sm">
                {sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <TeamField id="compare-first" label={t.compare.teamOne} value={first} options={options} onChange={(value) => { setFirst(value); suggest(value) }} />
            <TeamField id="compare-second" label={t.compare.teamTwo} value={second} options={options} onChange={(value) => { setSecond(value); suggest(value) }} />
            <button type="submit" disabled={busy || !first.trim() || !second.trim()} className={btn("navy", "md", "disabled:opacity-60")}>{t.compare.run}</button>
          </div>
        </form>
      </Panel>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {busy && <Panel><div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></Panel>}
      {data && <Results data={data} />}
      {data && plan === "premium" && <button type="button" onClick={save} className={btn("outline", "md")}><Bookmark aria-hidden className="size-4" /> {t.compare.save}</button>}
      {plan === "plus" && data && <p className="text-sm text-ink-2">{t.compare.plusNote} <Link href={href("/app/billing#plans")} className="font-semibold text-hot-text hover:underline">{t.compare.upgrade}</Link></p>}
      {views.length > 0 && (
        <Panel title={t.compare.savedViews} icon={<Bookmark aria-hidden />}>
          <ul className="divide-y divide-line">
            {views.map((view) => (
              <li key={view.id} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => open(view)} className="min-w-0 truncate text-left text-sm font-medium text-ink underline-offset-2 hover:underline">{view.first} / {view.second}</button>
                <button type="button" onClick={() => remove(view.id)} aria-label={`${t.compare.remove}: ${view.first} / ${view.second}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"><Trash2 aria-hidden className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
