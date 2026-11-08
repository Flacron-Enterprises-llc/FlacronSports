"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bookmark, GitCompareArrows, Lock, Trash2 } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { useAccount } from "@/components/dashboard/account-context"
import { ErrorNotice, Segmented } from "@/components/dashboard/controls"
import { btn, Panel, Skeleton } from "@/components/site/states"
import { ExportButton } from "@/components/sports/export-button"
import { LocalTime, SpoilerGuard, SpoilerReveal, SpoilerScope } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { trackFeatureUsed } from "@/lib/growth-engine"
import { hasPlusFeatures } from "@/lib/billing/plans"
import type { Comparison, PlayerComparison, TeamProfile } from "@/lib/sports/compare"
import { playerRows, teamSheet } from "@/lib/sports/compare-rows"
import { INDIVIDUAL_SPORTS } from "@/lib/sports/entrants"
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

const FORM_TONE = { W: "fs-form-win", D: "fs-form-draw", L: "fs-form-loss", T: "fs-form-draw", N: "fs-form-draw" }

function Form({ team }: { team: TeamProfile }) {
  const { t } = useLocale()
  if (team.form.length === 0) return <span className="text-ink-3">–</span>
  return (
    <span className="inline-flex flex-wrap gap-0.5">
      {team.form.map((result, index) => (
        <span key={index} className={cn("inline-flex size-6 items-center justify-center rounded-md font-sans text-[11px] font-bold", FORM_TONE[result])} title={t.compare.results[result]}>
          {t.compare.letters[result]}
        </span>
      ))}
    </span>
  )
}

function Row({ label, first, second }: { label: string; first: React.ReactNode; second: React.ReactNode }) {
  return (
    <tr>
      <td className="tabular py-2.5 pr-2 text-right font-display text-[15px] font-semibold text-ink">{first}</td>
      <th scope="row" className="px-1 py-2.5 text-center text-[13px] font-medium text-ink-2">{label}</th>
      <td className="tabular py-2.5 pl-2 text-left font-display text-[15px] font-semibold text-ink">{second}</td>
    </tr>
  )
}

function Results({ data, asked }: { data: Comparison; asked: { first: string; second: string; sport: SportId | null } }) {
  const { locale, t } = useLocale()
  const [one, two] = data.teams
  // The screen and the PDF read the same rows, so a sport's terms hold in both.
  const sheet = teamSheet(data, t)

  return (
    <Panel title={`${one.name} / ${two.name}`} description={sheet.notes[0]} icon={<GitCompareArrows aria-hidden />}>
      <SpoilerScope>
        <SpoilerReveal label={t.compare.reveal} />
        <SpoilerGuard label={t.compare.reveal} quiet>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] table-fixed">
              <caption className="sr-only">{t.compare.title}</caption>
              <thead>
                <tr className="border-b border-line text-sm text-ink">
                  <th scope="col" className="break-words py-2 pr-2 text-right font-semibold">{one.name}</th>
                  <th scope="col" className="w-[38%] px-1 py-2 text-center text-xs font-medium text-ink-2">{t.compare.measure}</th>
                  <th scope="col" className="break-words py-2 pl-2 text-left font-semibold">{two.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <Row label={t.compare.form} first={<Form team={one} />} second={<Form team={two} />} />
                {sheet.rows.slice(1).map(([label, first, second]) => <Row key={label} label={label} first={first} second={second} />)}
              </tbody>
            </table>
          </div>
          {data.tier === "advanced" && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-ink">{t.compare.headToHead}</h3>
              {data.headToHead.length === 0 && <p className="mt-1 text-sm text-ink-2">{t.compare.noHeadToHead}</p>}
              <ul className="mt-1.5 divide-y divide-line text-sm text-ink-2">
                {data.headToHead.map((game) => (
                  <li key={game.id} className="flex min-h-9 items-center justify-between gap-3 py-1">
                    <span className="min-w-0 truncate">{game.title}</span>
                    <span className="tabular shrink-0 font-display font-semibold text-ink">{game.result}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* The file states results, so it sits behind the same reveal. */}
          <div className="mt-4 border-t border-line pt-4">
            <ExportButton endpoint="/api/exports/compare" body={{ mode: "teams", first: asked.first, second: asked.second, locale, ...(asked.sport ? { sport: asked.sport } : {}) }} label={t.compare.exportPdf} fileName="flacronsport-comparison.pdf" />
          </div>
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
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-ink">{label}</label>
      <input id={id} list={`${id}-list`} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" maxLength={120} className="fs-input h-10 w-full px-3 text-sm" />
      <datalist id={`${id}-list`}>{options.map((name) => <option key={name} value={name} />)}</datalist>
    </div>
  )
}

interface PlayerOption {
  id: string
  name: string
  team: string | null
}

const optionLabel = (player: PlayerOption) => (player.team ? `${player.name} (${player.team})` : player.name)

function PlayerCompare() {
  const { locale, t, href } = useLocale()
  const { plan } = useAccount()
  const [first, setFirst] = useState("")
  const [second, setSecond] = useState("")
  // Kept across searches, so finding the second player does not forget the first.
  const [known, setKnown] = useState<Record<string, string>>({})
  const [data, setData] = useState<PlayerComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const suggest = (text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2 || known[text]) return
    timer.current = setTimeout(async () => {
      const response = await authFetch(`/api/players/search?q=${encodeURIComponent(text.trim())}`).catch(() => null)
      if (!response?.ok) return
      const { players } = (await response.json()) as { players: PlayerOption[] }
      setKnown((current) => ({ ...current, ...Object.fromEntries(players.map((player) => [optionLabel(player), player.id])) }))
    }, 350)
  }

  const run = async () => {
    setError(null)
    setData(null)
    const missing = [first, second].find((name) => !known[name])
    if (missing !== undefined) return setError(t.compare.playerNotFound.replace("{player}", missing))
    if (known[first] === known[second]) return setError(t.compare.samePlayer)
    setBusy(true)
    const query = new URLSearchParams({ first: known[first], second: known[second] })
    const response = await authFetch(`/api/compare/players?${query}`).catch(() => null)
    setBusy(false)
    if (response?.ok) return setData(await response.json())
    setError(t.compare.failed)
  }

  const options = Object.keys(known)
  const [one, two] = data?.players ?? []
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
            <TeamField id="compare-player-first" label={t.compare.playerOne} value={first} options={options} onChange={(value) => { setFirst(value); suggest(value) }} />
            <GitCompareArrows aria-hidden className="mb-3 hidden size-4 shrink-0 text-ink-3 lg:block" />
            <TeamField id="compare-player-second" label={t.compare.playerTwo} value={second} options={options} onChange={(value) => { setSecond(value); suggest(value) }} />
            <button type="submit" disabled={busy || !first.trim() || !second.trim()} className={btn("navy", "md", "disabled:opacity-60")}>{t.compare.run}</button>
          </div>
        </form>
      </Panel>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {busy && <Panel><div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></Panel>}
      {data && one && two && (
        <Panel title={`${one.profile.name} / ${two.profile.name}`} description={t.compare.playerBasis} icon={<GitCompareArrows aria-hidden />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] table-fixed">
              <caption className="sr-only">{t.compare.title}</caption>
              <thead>
                <tr className="border-b border-line text-sm text-ink">
                  <th scope="col" className="break-words py-2 pr-2 text-right font-semibold">{one.profile.name}</th>
                  <th scope="col" className="w-[38%] px-1 py-2 text-center text-xs font-medium text-ink-2">{t.compare.measure}</th>
                  <th scope="col" className="break-words py-2 pl-2 text-left font-semibold">{two.profile.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {playerRows(data, t, locale).map(([label, left, right]) => <Row key={label} label={label} first={left} second={right} />)}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <ExportButton endpoint="/api/exports/compare" body={{ mode: "players", first: one.profile.id, second: two.profile.id, locale }} label={t.compare.exportPdf} fileName="flacronsport-comparison.pdf" />
          </div>
        </Panel>
      )}
      {plan === "plus" && data && <p className="text-sm text-ink-2">{t.compare.playerPlusNote} <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className="font-semibold text-hot-text hover:underline">{t.compare.upgrade}</Link></p>}
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
  const [asked, setAsked] = useState<{ first: string; second: string; sport: SportId | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const [mode, setMode] = useState<"teams" | "players">("teams")
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
      const response = await authFetch(`/api/teams/search?${new URLSearchParams({ q: text.trim(), sport })}`).catch(() => null)
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
    if (response?.ok) {
      setAsked({ first: one, second: two, sport: chosen })
      return setData(await response.json())
    }
    const body = (await response?.json().catch(() => null)) as { code?: string; team?: string } | null
    if (body?.code === "team_not_found") return setError(t.compare.notFound.replace("{team}", body.team ?? ""))
    setError(body?.code === "same_team" ? t.compare.sameTeam : t.compare.failed)
  }

  const save = async () => {
    const response = await authFetch("/api/compare/saved", { method: "POST", body: JSON.stringify({ first, second, sport }) }).catch(() => null)
    if (response?.ok) {
      trackFeatureUsed("compare_view_saved", { sport: sport || undefined })
      return loadViews()
    }
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
        <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className={btn("navy", "md", "mt-3")}>{t.compare.upgrade}</Link>
      </Panel>
    )
  }

  const options = [...new Set(suggestions)]
  const entrant = INDIVIDUAL_SPORTS.has(sport) ? (sport as "tennis" | "combat-sports" | "motorsport") : null
  const modes = <Segmented<"teams" | "players"> label={t.compare.mode} value={mode} onChange={setMode} options={[{ value: "teams", label: t.compare.teams }, { value: "players", label: t.compare.players }]} />
  if (mode === "players") return <div className="space-y-4">{modes}<PlayerCompare /></div>
  return (
    <div className="space-y-4">
      {modes}
      <Panel>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run()
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="lg:w-44">
              <label htmlFor="compare-sport" className="mb-1 block text-[13px] font-medium text-ink">{t.compare.sport}</label>
              <select
                id="compare-sport"
                value={sport}
                onChange={(event) => {
                  // A name belongs to its sport, so changing sport starts the two fields again.
                  setSport(event.target.value as SportId)
                  setFirst("")
                  setSecond("")
                  setSuggestions([])
                  setData(null)
                  setError(null)
                }}
                className="fs-input h-10 w-full px-2 text-sm"
              >
                {sports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <TeamField id="compare-first" label={entrant ? t.compare.entrantOne[entrant] : t.compare.teamOne} value={first} options={options} onChange={(value) => { setFirst(value); suggest(value) }} />
            <GitCompareArrows aria-hidden className="mb-3 hidden size-4 shrink-0 text-ink-3 lg:block" />
            <TeamField id="compare-second" label={entrant ? t.compare.entrantTwo[entrant] : t.compare.teamTwo} value={second} options={options} onChange={(value) => { setSecond(value); suggest(value) }} />
            <button type="submit" disabled={busy || !first.trim() || !second.trim()} className={btn("navy", "md", "disabled:opacity-60")}>{t.compare.run}</button>
          </div>
        </form>
      </Panel>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {busy && <Panel><div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></Panel>}
      {data && asked && <Results data={data} asked={asked} />}
      {data && plan === "premium" && <button type="button" onClick={save} className={btn("outline", "md")}><Bookmark aria-hidden className="size-4" /> {t.compare.save}</button>}
      {plan === "plus" && data && <p className="text-sm text-ink-2">{t.compare.plusNote} <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className="font-semibold text-hot-text hover:underline">{t.compare.upgrade}</Link></p>}
      {views.length > 0 && (
        <Panel title={t.compare.savedViews} icon={<Bookmark aria-hidden />}>
          <ul className="divide-y divide-line">
            {views.map((view) => (
              <li key={view.id} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => open(view)} className="min-w-0 truncate text-left text-sm font-medium text-ink underline-offset-2 hover:underline">{view.first} / {view.second}</button>
                <button type="button" onClick={() => remove(view.id)} aria-label={`${t.compare.remove}: ${view.first} / ${view.second}`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink sm:size-9"><Trash2 aria-hidden className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
