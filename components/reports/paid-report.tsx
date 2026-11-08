"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useAccount } from "@/components/dashboard/account-context"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, Skeleton } from "@/components/site/states"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { hasPlusFeatures } from "@/lib/billing/plans"
import type { FullReport } from "@/lib/content/full-report"
import { labelStats } from "@/lib/sports/detail"
import { useLocale } from "@/lib/use-locale"

/** The report beyond the basic line. The server decides how much a plan receives. */
export function FullReportSection({ slug }: { slug: string }) {
  const { locale, t, href } = useLocale()
  const { plan, loaded } = useAccount()
  const [report, setReport] = useState<FullReport | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch(`/api/reports/${encodeURIComponent(slug)}/full?locale=${locale}`).catch(() => null)
    if (!response?.ok) return setFailed(true)
    setReport(await response.json())
  }, [locale, slug])

  useEffect(() => {
    if (loaded && hasPlusFeatures(plan)) void load()
  }, [load, loaded, plan])

  if (!loaded) return null
  if (!hasPlusFeatures(plan)) {
    return (
      <div className="mt-6 rounded-lg border border-line bg-surface-muted p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles aria-hidden className="size-4 text-hot-text" /> {t.fullReport.lockedTitle}</p>
        <p className="mt-1 text-sm leading-6 text-ink-2">{t.fullReport.lockedBody}</p>
        <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className={btn("navy", "sm", "mt-3")}>{t.fullReport.upgrade}</Link>
      </div>
    )
  }
  if (failed) return <div className="mt-6"><ErrorNotice onRetry={load}>{t.fullReport.failed}</ErrorNotice></div>
  if (!report) return <div role="status" aria-label={t.ui.loading} className="mt-6 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
  if (report.state === "empty") return <p className="mt-6 text-sm leading-6 text-ink-2">{t.fullReport.empty}</p>
  const stats = labelStats(report.stats ?? [], t.match.stats, locale)

  return (
    <div className="mt-6 border-t border-line pt-5">
      <SpoilerGuard label={t.reports.reveal}>
        {report.moments.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-ink">{t.fullReport.moments}</h2>
            <ul className="mt-2 space-y-1.5 text-[15px] leading-6 text-ink">
              {report.moments.map((moment) => (
                <li key={moment.id}>
                  {moment.minute !== null && <span className="tabular font-semibold">{moment.minute}′ </span>}
                  {moment.kind !== "other" && t.match.timelineKinds[moment.kind]}
                  {moment.player ? `: ${moment.player}` : ""}
                  {moment.team ? ` (${moment.team})` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
        {report.summary.length > 0 && <p className="mt-4 text-[15.5px] leading-7 text-ink">{report.summary.join(" ")}</p>}
        {report.insights && report.insights.length > 0 && (
          <section className="mt-5">
            <h2 className="text-base font-semibold text-ink">{t.fullReport.analysis}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-6 text-ink">
              {report.insights.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
        )}
        {stats.length > 0 && (
          <dl className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-1.5 text-sm">
            {stats.map((row) => (
              <div key={row.key} className="col-span-3 grid grid-cols-subgrid">
                <dt className="text-ink-2">{row.label}</dt>
                <dd className="tabular font-semibold text-ink">{row.home}</dd>
                <dd className="tabular font-semibold text-ink">{row.away}</dd>
              </div>
            ))}
          </dl>
        )}
      </SpoilerGuard>
    </div>
  )
}

interface MineReport {
  id: string
  slug: string
  title: string
  competition: string
  publishedAt: string | null
}

/** Personalized reports: what was published about the teams this member follows. */
export function ForYouReports() {
  const { locale, t, href } = useLocale()
  const { plan, loaded } = useAccount()
  const [state, setState] = useState<{ reports: MineReport[]; favorites: number } | null>(null)

  useEffect(() => {
    if (!loaded || !hasPlusFeatures(plan)) return
    authFetch(`/api/reports/mine?locale=${locale}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setState)
      .catch(() => setState(null))
  }, [loaded, locale, plan])

  if (!loaded) return null
  if (!hasPlusFeatures(plan)) {
    return (
      <p className="fs-rise mb-5 rounded-lg border border-line bg-surface-muted p-3 text-sm leading-6 text-ink-2">
        {t.fullReport.forYouLocked} <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className="font-semibold text-hot-text hover:underline">{t.fullReport.upgrade}</Link>
      </p>
    )
  }
  if (!state) return null
  return (
    <section aria-labelledby="for-you" className="fs-rise mb-6 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
      <h2 id="for-you" className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles aria-hidden className="size-4 text-hot-text" /> {t.fullReport.forYou}</h2>
      {state.reports.length === 0 && (
        <p className="mt-1 text-sm leading-6 text-ink-2">
          {state.favorites === 0 ? t.fullReport.noFavorites : t.fullReport.noneYet}
          {state.favorites === 0 && <> <Link href={href("/app/my-teams")} className="font-semibold text-hot-text hover:underline">{t.nav.myTeams}</Link></>}
        </p>
      )}
      <ul className="mt-2 divide-y divide-line">
        {state.reports.map((report) => (
          <li key={report.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <Link href={href(`/app/news/${report.slug}`)} className="block truncate font-medium text-ink underline-offset-2 hover:underline">{report.title}</Link>
              <span className="block truncate text-xs text-ink-2">{report.competition}</span>
            </span>
            {report.publishedAt && <span className="shrink-0 text-xs text-ink-3"><LocalTime iso={report.publishedAt} /></span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
