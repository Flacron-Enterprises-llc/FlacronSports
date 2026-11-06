"use client"

import { useState } from "react"
import { Newspaper } from "lucide-react"
import { Segmented } from "@/components/dashboard/controls"
import { btn, EmptyState, Notice } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { QueueStatus } from "@/lib/admin/report-review"
import type { ReportSource, ReportType } from "@/lib/content/reports"
import { useLocale } from "@/lib/use-locale"
import { CARD, FIELD, Status, useAdminData, useWhen } from "./shared"

const STATUSES: QueueStatus[] = ["draft", "validated", "rejected", "corrected", "published"]

interface QueueReport {
  id: string
  type: ReportType
  locale: string
  status: QueueStatus
  title: string
  body: string
  competition: string
  sources: ReportSource[]
  promptVersion: string
  sourceVersion: string
  withheldReason: string | null
  correctionNote: string | null
  generatedAt: string
  updatedAt: string
  publishedAt: string | null
  previousVersions: number
}

function ReportCard({ report, onDone }: { report: QueueReport; onDone(message: string): void }) {
  const { t } = useLocale()
  const copy = t.admin.editorial
  const when = useWhen()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(report.title)
  const [body, setBody] = useState(report.body)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const send = async (action: "correct" | "publish" | "reject" | "rollback") => {
    if (note.trim().length < 3) return setError(copy.noteRequired)
    if (action === "correct" && !body.trim()) return setError(copy.bodyRequired)
    setBusy(true)
    setError(null)
    const payload = action === "correct" ? { action, note, body, title: title.trim() || undefined } : { action, note }
    const response = await authFetch(`/api/admin/reports/${encodeURIComponent(report.id)}`, { method: "POST", body: JSON.stringify(payload) }).catch(() => null)
    setBusy(false)
    if (response?.ok) return onDone(copy.done[action])
    const code = (await response?.json().catch(() => null))?.code as keyof typeof copy.errors | undefined
    setError((code && copy.errors[code]) || t.admin.actionFailed)
  }

  const button = btn("outline", "sm")
  const withheld = report.withheldReason ? copy.reasons[report.withheldReason as keyof typeof copy.reasons] ?? report.withheldReason : null
  return (
    <li className={CARD}>
      <p className="text-xs font-semibold text-hot-text">{t.reports.types[report.type]} · {report.locale.toUpperCase()}</p>
      <h3 className="mt-1 break-words text-[15px] font-semibold text-ink">{report.title || copy.untitled}</h3>
      {report.competition && <p className="text-sm text-ink-2">{report.competition}</p>}
      {withheld && <Notice className="mt-2" tone="warning" role="note">{withheld}</Notice>}
      {!editing && report.body && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-ink">{report.body}</p>}
      {report.correctionNote && <p className="mt-2 text-sm text-ink-2">{t.reports.correction}: {report.correctionNote}</p>}
      {editing && (
        <div className="mt-3 space-y-2">
          <label className="block text-sm font-medium text-ink">{copy.titleField}<input className={`mt-1 ${FIELD}`} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block text-sm font-medium text-ink">{copy.bodyField}<textarea className="fs-input mt-1 min-h-40 w-full p-3 text-sm leading-6" maxLength={6000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        </div>
      )}
      <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-3 sm:grid-cols-2">
        <div><dt className="inline">{copy.generated}: </dt><dd className="inline">{when(report.generatedAt)}</dd></div>
        <div><dt className="inline">{t.reports.updated}: </dt><dd className="inline">{when(report.updatedAt)}</dd></div>
        <div><dt className="inline">{copy.template}: </dt><dd className="inline break-all">{report.promptVersion}</dd></div>
        <div><dt className="inline">{copy.sourceVersion}: </dt><dd className="inline break-all">{report.sourceVersion}</dd></div>
        {report.sources.slice(0, 3).map((source) => <div key={source.eventId} className="sm:col-span-2"><dt className="inline">{t.reports.source}: </dt><dd className="inline break-all">{source.provider} · {source.eventId} · {when(source.fetchedAt)}</dd></div>)}
        {report.sources.length > 3 && <div className="sm:col-span-2"><dd>{copy.moreSources.replace("{count}", String(report.sources.length - 3))}</dd></div>}
      </dl>
      <label className="mt-3 block text-sm font-medium text-ink">{copy.note}<input className={`mt-1 ${FIELD}`} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error && <Notice className="mt-2" tone="warning" role="alert">{error}</Notice>}
      <div className="mt-3 flex flex-wrap gap-2">
        {editing
          ? <button type="button" disabled={busy} className={btn("navy", "sm")} onClick={() => send("correct")}>{copy.saveCorrection}</button>
          : <button type="button" disabled={busy} className={button} onClick={() => setEditing(true)}>{copy.correct}</button>}
        {editing && <button type="button" disabled={busy} className={button} onClick={() => setEditing(false)}>{t.ui.keep}</button>}
        {report.status !== "published" && report.status !== "corrected" && report.body && <button type="button" disabled={busy} className={button} onClick={() => send("publish")}>{copy.publish}</button>}
        {report.status !== "rejected" && <button type="button" disabled={busy} className={button} onClick={() => send("reject")}>{copy.reject}</button>}
        <button type="button" disabled={busy || report.previousVersions === 0} className={button} onClick={() => send("rollback")}>{copy.rollback}</button>
      </div>
    </li>
  )
}

export function EditorialTab() {
  const { t } = useLocale()
  const copy = t.admin.editorial
  const [status, setStatus] = useState<QueueStatus>("draft")
  const [notice, setNotice] = useState<string | null>(null)
  const { data, failed, load } = useAdminData<{ reports: QueueReport[] }>(`/api/admin/reports?status=${status}`)
  const reports = data?.reports.filter((report) => report.status === status)

  return (
    <div className="space-y-4">
      <Segmented<QueueStatus> value={status} onChange={setStatus} label={copy.queue} options={STATUSES.map((value) => ({ value, label: copy.statuses[value] }))} />
      <p className="text-sm leading-6 text-ink-2">{copy.help}</p>
      <Status failed={failed} loaded={Boolean(data)} onRetry={load} />
      {notice && <Notice role="status">{notice}</Notice>}
      {reports?.length === 0 && <EmptyState compact icon={<Newspaper aria-hidden />} title={copy.empty} />}
      <ul className="space-y-3">
        {reports?.map((report) => <ReportCard key={`${report.id}-${report.updatedAt}`} report={report} onDone={(message) => { setNotice(message); load() }} />)}
      </ul>
    </div>
  )
}
