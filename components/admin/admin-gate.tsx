"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Gauge, Newspaper, Radar, ScrollText, ShieldAlert, Wallet } from "lucide-react"
import { Tabs } from "@/components/dashboard/controls"
import { btn, EmptyState, ListSkeleton, Notice } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { MoneyLine } from "@/lib/admin/billing-health"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { CommunityTab } from "./community-tab"
import { CoverageTab } from "./coverage-tab"
import { EditorialTab } from "./editorial-tab"
import { OperationsTab } from "./operations-tab"
import { CARD, Fact, FIELD, Status, useAdminData } from "./shared"

type Role = "moderator" | "editor" | "admin"
type Tab = "operations" | "coverage" | "editorial" | "moderation" | "community" | "billing"

const TABS: Record<Role, Tab[]> = { admin: ["operations", "coverage", "editorial", "moderation", "community", "billing"], moderator: ["moderation", "community"], editor: ["editorial"] }
const TAB_ICONS = { operations: Gauge, coverage: Radar, editorial: Newspaper, moderation: ShieldAlert, community: ScrollText, billing: Wallet }

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
              {report.scope === "room" && <button type="button" className={button} onClick={() => act({ action: "revoke_invite", roomId: report.scopeId })}>{t.admin.community.revoke}</button>}
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
  const Icon = TAB_ICONS[id]
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

  return (
    <div>
      <Tabs<Tab> value={tab ?? tabs[0]} onChange={setTab} tabs={tabs.map((id) => ({ value: id, label: t.admin.tabs[id], icon: <TabIcon id={id} /> }))} label={t.admin.title}>
        {(tab ?? tabs[0]) === "operations" && <OperationsTab />}
        {(tab ?? tabs[0]) === "coverage" && <CoverageTab />}
        {(tab ?? tabs[0]) === "editorial" && <EditorialTab />}
        {(tab ?? tabs[0]) === "moderation" && <ModerationTab />}
        {(tab ?? tabs[0]) === "community" && <CommunityTab />}
        {(tab ?? tabs[0]) === "billing" && <BillingTab />}
      </Tabs>
    </div>
  )
}
