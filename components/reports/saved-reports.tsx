"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, EmptyState, ListSkeleton } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import type { SavedReportItem } from "@/lib/me/saved-reports"
import { useLocale } from "@/lib/use-locale"

export function useSavedReports() {
  const { locale } = useLocale()
  const [reports, setReports] = useState<SavedReportItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch(`/api/me/saved-reports?locale=${locale}`).catch(() => null)
    if (!response?.ok) return setFailed(true)
    setReports(((await response.json()) as { reports: SavedReportItem[] }).reports)
  }, [locale])

  useEffect(() => {
    void load()
  }, [load])

  return { reports, failed, load, setReports }
}

const send = (method: "POST" | "DELETE", slug: string) => authFetch("/api/me/saved-reports", { method, body: JSON.stringify({ slug }) }).catch(() => null)

export function SaveReportButton({ slug }: { slug: string }) {
  const { t } = useLocale()
  const copy = t.discover
  const { reports, failed } = useSavedReports()
  const [saved, setSaved] = useState<boolean | null>(null)
  const on = saved ?? reports?.some((report) => report.slug === slug) ?? false

  const press = async () => {
    setSaved(!on)
    const response = await send(on ? "DELETE" : "POST", slug)
    if (response?.ok) return
    setSaved(on)
    const data = await response?.json().catch(() => null)
    toast(data?.code === "saved_limit" ? copy.savedLimit : t.ui.saveFailed)
  }

  return (
    <button type="button" aria-pressed={on} onClick={press} disabled={reports === null && !failed} className={btn("outline", "sm")}>
      {on ? <BookmarkCheck aria-hidden className="size-3.5 text-hot-text" /> : <Bookmark aria-hidden className="size-3.5" />}
      {on ? copy.unsave : copy.save}
    </button>
  )
}

export function SavedReports() {
  const { t, href } = useLocale()
  const copy = t.discover
  const { reports, failed, load, setReports } = useSavedReports()

  const remove = async (slug: string) => {
    const response = await send("DELETE", slug)
    if (!response?.ok) return void toast(t.ui.saveFailed)
    setReports((current) => current?.filter((report) => report.slug !== slug) ?? null)
  }

  if (failed) return <ErrorNotice onRetry={load}>{copy.savedFailed}</ErrorNotice>
  if (!reports) return <div role="status" aria-label={t.ui.loading}><ListSkeleton /></div>
  if (reports.length === 0) return <EmptyState icon={<Bookmark aria-hidden />} title={copy.savedEmpty} body={copy.savedEmptyBody} action={{ href: href("/app/news"), label: t.dash.allReports }} />

  return (
    <ul className="fs-settle grid gap-3 sm:grid-cols-2">
      {reports.map((report) => (
        <li key={report.slug} className="flex min-w-0 items-start gap-2 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
          <div className="min-w-0 flex-1">
            <Link href={href(`/app/news/${report.slug}`)} className="block text-[15px] font-semibold leading-6 text-ink underline-offset-2 hover:underline">{report.title}</Link>
            <p className="mt-1 truncate text-xs text-ink-2">{report.competition}{report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}</p>
          </div>
          <button type="button" onClick={() => remove(report.slug)} aria-label={`${copy.unsave}: ${report.title}`} title={copy.unsave} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-muted hover:text-bad"><Trash2 aria-hidden className="size-4" /></button>
        </li>
      ))}
    </ul>
  )
}
