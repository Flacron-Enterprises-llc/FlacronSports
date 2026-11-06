"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Gauge, ShieldAlert, Wallet } from "lucide-react"
import { ErrorNotice, Tabs } from "@/components/dashboard/controls"
import { btn, EmptyState, ListSkeleton, Notice } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { MoneyLine } from "@/lib/admin/billing-health"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

type Role = "moderator" | "editor" | "admin"
type Tab = "operations" | "moderation" | "billing"

const TABS: Record<Role, Tab[]> = { admin: ["operations", "moderation", "billing"], moderator: ["moderation"], editor: [] }
const CARD = "rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]"
const FIELD = "fs-input h-10 px-3 text-sm"

function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    setFailed(false)
    authFetch(path)
      .then(async (response) => {
        if (!response.ok) throw new Error("request failed")
        setData(await response.json())
      })
      .catch(() => setFailed(true))
  }, [path])
  useEffect(load, [load])
  return { data, failed, load }
}

function Status({ failed, loaded, onRetry }: { failed: boolean; loaded: boolean; onRetry(): void }) {
  const { t } = useLocale()
  if (failed) return <ErrorNotice onRetry={onRetry}>{t.admin.loadFailed}</ErrorNotice>
  return loaded ? null : <div role="status" aria-label={t.admin.loading}><ListSkeleton rows={3} /></div>
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return <div className={CARD}><dt className="text-sm text-ink-2">{label}</dt><dd className="mt-1 text-lg font-semibold text-ink tabular">{value}</dd></div>
}

interface Operations {
  feed: { state: string; source: string; fetchedAt: string; limited: boolean; events: number }
  jobs: { enabled: boolean; lastReportGeneratedAt: string | null; reportsReadable: boolean }
}

function OperationsTab() {
  const { t, locale } = useLocale()
  const { data, failed, load } = useAdminData<Operations>("/api/admin/operations")
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  return (
    <div className="space-y-4">
      <Status failed={failed} loaded={Boolean(data)} onRetry={load} />
      {data && (
        <>
          <dl className="fs-stagger grid gap-3 sm:grid-cols-2">
            <Fact label={t.admin.feedState} value={`${t.ui.feedStates[data.feed.state as keyof typeof t.ui.feedStates] ?? t.ui.feedStates.unavailable}${data.feed.limited ? ` (${t.admin.limitedFeed})` : ""}`} />
            <Fact label={t.admin.feedEvents} value={data.feed.events} />
            <Fact label={t.feed.updated} value={when(data.feed.fetchedAt)} />
            <Fact label={t.admin.jobsEnabled} value={data.jobs.enabled ? t.admin.yes : t.admin.no} />
            <Fact label={t.admin.lastReport} value={data.jobs.lastReportGeneratedAt ? when(data.jobs.lastReportGeneratedAt) : t.admin.none} />
          </dl>
          <p className="text-sm text-ink-2">{t.admin.jobsNote}</p>
        </>
      )}
    </div>
  )
}

interface Report {
  id: string
  scope: "match" | "room"
  scopeId: string
  messageId: string
  targetUid: string
  messageText: string
  reason: string
  createdAtUTC: string
}

function ModerationTab() {
  const { t, href } = useLocale()
  const { data, failed, load } = useAdminData<{ reports: Report[] }>("/api/admin/moderation")
  const [reason, setReason] = useState("")
  const [hours, setHours] = useState(24)
  const [notice, setNotice] = useState<string | null>(null)

  const act = async (body: Record<string, unknown>) => {
    if (reason.trim().length < 3) return setNotice(t.admin.reasonRequired)
    const response = await authFetch("/api/admin/moderation", { method: "POST", body: JSON.stringify({ ...body, reason }) }).catch(() => null)
    setNotice(response?.ok ? t.admin.done : t.admin.actionFailed)
    if (response?.ok) load()
  }

  const button = btn("outline", "sm")
  return (
    <div className="space-y-4">
      <Status failed={failed} loaded={Boolean(data)} onRetry={load} />
      <label className="block text-sm font-medium text-ink">{t.admin.reason}<input className={`mt-1 ${FIELD}`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <label className="block text-sm font-medium text-ink">{t.admin.hours}<input className={`mt-1 ${FIELD}`} type="number" min={1} max={8760} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></label>
      {notice && <Notice role="status">{notice}</Notice>}
      {data?.reports.length === 0 && <EmptyState compact icon={<ShieldAlert aria-hidden />} title={t.admin.noReports} />}
      <ul className="space-y-3">
        {data?.reports.map((report) => (
          <li key={report.id} className={CARD}>
            <p className="text-sm font-semibold text-ink">{t.community.reportReasons[report.reason as keyof typeof t.community.reportReasons] ?? t.community.reportReasons.other} · {report.scope === "match" ? <Link href={href(`/app/match/${report.scopeId}`)} className="text-hot-text underline">{t.ui.matchCenter}</Link> : t.dash.rooms}</p>
            <p className="mt-1 break-words text-sm text-ink-2">{report.messageText}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => act({ action: "remove_message", scope: report.scope, scopeId: report.scopeId, messageId: report.messageId, reportId: report.id })}>{t.admin.removeMessage}</button>
              <button type="button" className={button} onClick={() => act({ action: "sanction", uid: report.targetUid, type: "mute", hours })}>{t.admin.mute}</button>
              <button type="button" className={button} onClick={() => act({ action: "sanction", uid: report.targetUid, type: "suspend", hours })}>{t.admin.suspend}</button>
              <button type="button" className={button} onClick={() => act({ action: "lock", scope: report.scope, scopeId: report.scopeId, locked: true })}>{t.admin.lock}</button>
              <button type="button" className={button} onClick={() => act({ action: "resolve_report", reportId: report.id })}>{t.admin.resolve}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface BillingHealth {
  processedEvents: number
  quarantinedEvents: number
  purchasesNeedingReview: number
  grossInvoices: MoneyLine[]
  addonSales: MoneyLine[]
  refunds: MoneyLine[]
  truncated: boolean
}

function MoneyList({ title, lines }: { title: string; lines: MoneyLine[] }) {
  const { t, locale } = useLocale()
  const money = (line: MoneyLine) =>
    line.currency.length === 3
      ? new Intl.NumberFormat(locale, { style: "currency", currency: line.currency }).format(line.minorUnits / 100)
      : String(line.minorUnits)
  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {lines.length === 0 && <p className="mt-1 text-sm text-ink-2">{t.admin.none}</p>}
      <ul className="mt-1 space-y-1 text-sm text-ink-2">
        {lines.map((line) => <li key={`${line.currency}-${line.livemode}`}>{money(line)} · {line.count} · {line.livemode ? t.admin.live : t.admin.test}</li>)}
      </ul>
    </section>
  )
}

function BillingTab() {
  const { t } = useLocale()
  const { data, failed, load } = useAdminData<BillingHealth>("/api/admin/billing-health")
  return (
    <div className="space-y-4">
      <Status failed={failed} loaded={Boolean(data)} onRetry={load} />
      {data && (
        <>
          <dl className="fs-stagger grid gap-3 sm:grid-cols-3">
            <Fact label={t.admin.processed} value={data.processedEvents} />
            <Fact label={t.admin.quarantined} value={data.quarantinedEvents} />
            <Fact label={t.admin.needReview} value={data.purchasesNeedingReview} />
          </dl>
          <MoneyList title={t.admin.gross} lines={data.grossInvoices} />
          <MoneyList title={t.admin.addons} lines={data.addonSales} />
          <MoneyList title={t.admin.refunds} lines={data.refunds} />
          {data.truncated && <Notice tone="warning" role="status">{t.admin.truncated}</Notice>}
        </>
      )}
    </div>
  )
}

function TabIcon({ id }: { id: Tab }) {
  const Icon = id === "operations" ? Gauge : id === "moderation" ? ShieldAlert : Wallet
  return <Icon aria-hidden className="size-4" />
}

export function AdminGate() {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [access, setAccess] = useState<"checking" | "denied" | "mfa">("checking")
  const [role, setRole] = useState<Role | null>(null)
  const [tab, setTab] = useState<Tab | null>(null)

  useEffect(() => {
    if (!user) return
    authFetch("/api/admin/status")
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) return setAccess(data?.code === "mfa_required" ? "mfa" : "denied")
        setRole(data.role)
        setTab(TABS[data.role as Role]?.[0] ?? null)
      })
      .catch(() => setAccess("denied"))
  }, [user])

  if (!role) {
    if (access === "mfa") {
      return <EmptyState icon={<ShieldAlert aria-hidden />} title={t.admin.mfaRequired} action={{ href: href("/app/settings/security"), label: t.security.title }} />
    }
    if (access === "checking") return <div role="status" aria-label={t.admin.checking}><ListSkeleton rows={3} /></div>
    return <EmptyState icon={<ShieldAlert aria-hidden />} title={t.admin.denied} action={{ href: href("/app"), label: t.dash.dashboard }} />
  }

  const tabs = TABS[role]
  if (tabs.length === 0) return <Notice role="status">{t.admin.editorNote}</Notice>

  return (
    <div>
      <Tabs<Tab> value={tab ?? tabs[0]} onChange={setTab} tabs={tabs.map((id) => ({ value: id, label: t.admin.tabs[id], icon: <TabIcon id={id} /> }))} label={t.admin.title}>
        {(tab ?? tabs[0]) === "operations" && <OperationsTab />}
        {(tab ?? tabs[0]) === "moderation" && <ModerationTab />}
        {(tab ?? tabs[0]) === "billing" && <BillingTab />}
      </Tabs>
    </div>
  )
}
