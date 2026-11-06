"use client"

import { useState } from "react"
import { btn, Notice } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { BreakerStatus } from "@/lib/sports/breaker"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { CARD, Fact, FIELD, ReasonField, Status, useAdminData, useWhen } from "./shared"

const JOBS = ["predictions", "reports", "alerts", "newsletter", "recaps", "previews", "roundup", "calendar", "clips"] as const
type Job = (typeof JOBS)[number]

interface Run {
  at: string
  finishedAt: string
  trigger: "schedule" | "admin"
  job: string
  failed: string[]
  aborted: boolean
}

interface Operations {
  feed: { state: string; source: string; fetchedAt: string; limited: boolean; events: number }
  jobs: { enabled: boolean; lastRunAt: string | null; overdue: boolean }
  flags: { video: boolean; publishing: boolean; payments: boolean }
  providers: BreakerStatus[]
  sports: Partial<Record<SportId, string>>
  staleSports: { sportId: SportId; lastSeenAt: string | null }[]
  runs: Run[]
  days: { date: string; counters: Record<string, number> }[]
  unflushed: Record<string, number>
  subscriptions: { active: number; pastDue: number; canceled: number; quarantined: number; needReview: number } | null
}

function Rerun({ onStarted }: { onStarted(): void }) {
  const { t } = useLocale()
  const copy = t.admin.ops
  const [job, setJob] = useState<Job>("reports")
  const [reason, setReason] = useState("")
  const [notice, setNotice] = useState<string | null>(null)

  const start = async () => {
    if (reason.trim().length < 3) return setNotice(t.admin.reasonRequired)
    const response = await authFetch("/api/admin/jobs", { method: "POST", body: JSON.stringify({ job, reason }) }).catch(() => null)
    setNotice(response?.ok ? copy.started : response?.status === 409 ? copy.busy : t.admin.actionFailed)
    if (response?.ok) onStarted()
  }

  return (
    <section className={`${CARD} space-y-3`}>
      <h3 className="text-sm font-semibold text-ink">{copy.rerunTitle}</h3>
      <p className="text-sm leading-6 text-ink-2">{copy.rerunHelp}</p>
      <label className="block text-sm font-medium text-ink">{copy.job}
        <select className={`mt-1 ${FIELD}`} value={job} onChange={(e) => setJob(e.target.value as Job)}>
          {JOBS.map((name) => <option key={name} value={name}>{copy.jobs[name]}</option>)}
        </select>
      </label>
      <ReasonField value={reason} onChange={setReason} />
      {notice && <Notice role="status">{notice}</Notice>}
      <button type="button" className={btn("outline", "sm")} onClick={start}>{copy.rerun}</button>
    </section>
  )
}

export function OperationsTab() {
  const { t, locale } = useLocale()
  const copy = t.admin.ops
  const when = useWhen()
  const { data, failed, load } = useAdminData<Operations>("/api/admin/operations")
  const sportName = (id: SportId) => SPORTS.find((sport) => sport.id === id)?.name[locale] ?? id
  const flag = (on: boolean) => (on ? copy.on : copy.off)

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = (name: string) => (data?.days.find((day) => day.date === today)?.counters[name] ?? 0) + (data?.unflushed[name] ?? 0)
  const weekCount = (name: string) => (data?.days ?? []).reduce((total, day) => total + (day.counters[name] ?? 0), data?.unflushed[name] ?? 0)
  const Counter = ({ label, name }: { label: string; name: string }) => (
    <div className="flex justify-between gap-3 py-1 text-sm"><dt className="text-ink-2">{label}</dt><dd className="tabular font-medium text-ink">{todayCount(name)} / {weekCount(name)}</dd></div>
  )
  const failedRuns = data?.runs.filter((run) => run.aborted || run.failed.length > 0) ?? []

  return (
    <div className="space-y-4">
      <Status failed={failed} loaded={Boolean(data)} onRetry={load} />
      {data && (
        <>
          {data.jobs.overdue && <Notice tone="warning" role="alert">{copy.overdue}</Notice>}
          <dl className="fs-stagger grid gap-3 sm:grid-cols-2">
            <Fact label={t.admin.feedState} value={`${t.ui.feedStates[data.feed.state as keyof typeof t.ui.feedStates] ?? t.ui.feedStates.unavailable}${data.feed.limited ? ` (${t.admin.limitedFeed})` : ""}`} />
            <Fact label={t.admin.feedEvents} value={data.feed.events} />
            <Fact label={t.feed.updated} value={when(data.feed.fetchedAt)} />
            <Fact label={t.admin.jobsEnabled} value={data.jobs.enabled ? t.admin.yes : t.admin.no} />
            <Fact label={copy.lastRun} value={data.jobs.lastRunAt ? when(data.jobs.lastRunAt) : t.admin.none} />
            <Fact label={copy.flags} value={`${copy.video} ${flag(data.flags.video)} · ${copy.publishing} ${flag(data.flags.publishing)} · ${copy.payments} ${flag(data.flags.payments)}`} />
          </dl>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-ink">{copy.providers}</h3>
            <ul className="mt-2 space-y-3">
              {data.providers.map((provider) => {
                const name = provider.provider as "feed" | "live"
                return (
                  <li key={name} className="text-sm">
                    <p className="font-medium text-ink">{copy.providerNames[name]}: {copy.breaker[provider.state]}</p>
                    {provider.lastError && <p className="text-xs text-ink-3">{copy.lastError}: {provider.lastError}{provider.retryAt ? ` · ${copy.retryAt}: ${when(provider.retryAt)}` : ""}</p>}
                    <dl><Counter label={copy.calls} name={`${name}_calls`} /><Counter label={copy.rateLimited} name={`${name}_rate_limited`} /><Counter label={copy.failures} name={`${name}_failures`} /></dl>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-3">{copy.countsNote}</p>
          </section>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-ink">{copy.sports}</h3>
            {Object.keys(data.sports).length === 0 && <p className="mt-1 text-sm text-ink-2">{t.admin.none}</p>}
            <ul className="mt-1 grid gap-x-4 text-sm text-ink-2 sm:grid-cols-2">
              {Object.entries(data.sports).map(([id, state]) => <li key={id}>{sportName(id as SportId)}: {t.ui.feedStates[state as keyof typeof t.ui.feedStates] ?? state}</li>)}
            </ul>
            {data.staleSports.length > 0 && (
              <>
                <h4 className="mt-3 text-sm font-semibold text-ink">{copy.stale}</h4>
                <p className="text-xs text-ink-3">{copy.staleNote}</p>
                <ul className="mt-1 text-sm text-ink-2">
                  {data.staleSports.map((row) => <li key={row.sportId}>{sportName(row.sportId)}: {row.lastSeenAt ? when(row.lastSeenAt) : t.admin.none}</li>)}
                </ul>
              </>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className={CARD}>
              <h3 className="text-sm font-semibold text-ink">{copy.email}</h3>
              <dl className="mt-1"><Counter label={copy.sent} name="email_sent" /><Counter label={copy.failed} name="email_failed" /><Counter label={copy.notConfigured} name="email_not_configured" /></dl>
            </section>
            <section className={CARD}>
              <h3 className="text-sm font-semibold text-ink">{copy.playback}</h3>
              <dl className="mt-1"><Counter label={copy.playbackOk} name="playback_ok" /><Counter label={copy.playbackFailed} name="playback_failed" /></dl>
            </section>
          </div>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-ink">{copy.subscriptions}</h3>
            {data.subscriptions ? (
              <dl className="mt-1 grid gap-x-6 sm:grid-cols-2">
                {([["active", data.subscriptions.active], ["pastDue", data.subscriptions.pastDue], ["canceled", data.subscriptions.canceled], ["quarantined", data.subscriptions.quarantined], ["needReview", data.subscriptions.needReview]] as const).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 py-1 text-sm"><dt className="text-ink-2">{copy.subscriptionRows[key]}</dt><dd className="tabular font-medium text-ink">{value}</dd></div>
                ))}
              </dl>
            ) : <p className="mt-1 text-sm text-ink-2">{t.admin.loadFailed}</p>}
          </section>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-ink">{copy.runs}</h3>
            {data.runs.length === 0 && <p className="mt-1 text-sm text-ink-2">{t.admin.none}</p>}
            {failedRuns.length > 0 && <p className="mt-1 text-sm font-medium text-ink">{copy.failedCount.replace("{count}", String(failedRuns.length))}</p>}
            <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto text-sm">
              {data.runs.map((run) => (
                <li key={`${run.trigger}-${run.at}`} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                  <span className="text-ink-2">{when(run.at)} · {run.job === "tick" ? copy.scheduled : copy.jobs[run.job as Job] ?? run.job}{run.trigger === "admin" ? ` · ${copy.manual}` : ""}</span>
                  <span className="font-medium text-ink">{run.aborted ? copy.aborted : run.failed.length ? run.failed.map((name) => copy.jobs[name as Job] ?? name).join(", ") : copy.clean}</span>
                </li>
              ))}
            </ul>
          </section>

          <Rerun onStarted={load} />
        </>
      )}
    </div>
  )
}
