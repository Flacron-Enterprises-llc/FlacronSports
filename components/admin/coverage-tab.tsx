"use client"

import { useState } from "react"
import { Radar } from "lucide-react"
import { Switch } from "@/components/dashboard/controls"
import { EmptyState, Notice } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { CARD, FIELD, ReasonField, Status, useAdminData, useWhen } from "./shared"

const PAGE = 40

interface Competition {
  name: string
  country: string | null
  lastSeenAt: string
  events: number
  enabled: boolean
  video: boolean
  videoOnly?: boolean
}

interface SportRow {
  id: SportId
  enabled: boolean
  lastSeenAt: string | null
  competitions: Competition[]
}

export function CoverageTab() {
  const { t, locale } = useLocale()
  const copy = t.admin.coverage
  const when = useWhen()
  const { data, failed, load } = useAdminData<{ sports: SportRow[] }>("/api/admin/coverage")
  const [reason, setReason] = useState("")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (change: Record<string, unknown>) => {
    if (reason.trim().length < 3) return setNotice(t.admin.reasonRequired)
    setBusy(true)
    const response = await authFetch("/api/admin/coverage", { method: "POST", body: JSON.stringify({ ...change, reason }) }).catch(() => null)
    setBusy(false)
    setNotice(response?.ok ? copy.saved : t.admin.actionFailed)
    if (response?.ok) load()
  }

  const needle = search.trim().toLowerCase()
  const sportName = (id: SportId) => SPORTS.find((sport) => sport.id === id)?.name[locale] ?? id

  return (
    <div className="space-y-4">
      <Status failed={failed} loaded={Boolean(data)} onRetry={load} />
      <p className="text-sm leading-6 text-ink-2">{copy.help}</p>
      <ReasonField value={reason} onChange={setReason} />
      <label className="block text-sm font-medium text-ink">{copy.search}<input type="search" className={`mt-1 ${FIELD}`} value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      {notice && <Notice role="status">{notice}</Notice>}
      {data?.sports.every((sport) => sport.competitions.length === 0) && <EmptyState compact icon={<Radar aria-hidden />} title={copy.noData} />}
      <ul className="space-y-3">
        {data?.sports.map((sport) => {
          const rows = sport.competitions.filter((row) => !needle || row.name.toLowerCase().includes(needle))
          if (needle && rows.length === 0) return null
          return (
            <li key={sport.id} className={CARD}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">{sportName(sport.id)}</h3>
                  <p className="text-xs text-ink-3">{copy.lastSeen}: {sport.lastSeenAt ? when(sport.lastSeenAt) : t.admin.none}</p>
                </div>
                <Switch checked={sport.enabled} disabled={busy} label={`${copy.show}: ${sportName(sport.id)}`} onChange={(enabled) => save({ type: "sport", sportId: sport.id, enabled })} />
              </div>
              {rows.length > 0 && (
                <details className="mt-3 border-t border-line pt-3" open={Boolean(needle)}>
                  <summary className="cursor-pointer text-sm font-medium text-ink-2">{copy.competitions.replace("{count}", String(rows.length))}</summary>
                  <ul className="mt-2 divide-y divide-line">
                    {rows.slice(0, PAGE).map((row) => (
                      <li key={row.name} className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-ink">{row.name}{row.country ? ` · ${row.country}` : ""}</p>
                          <p className="text-xs text-ink-3">{copy.lastSeen}: {when(row.lastSeenAt)}{row.videoOnly ? ` · ${copy.videoOnly}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-ink-2">
                          {!row.videoOnly && <span className="flex items-center gap-1.5">{copy.show}<Switch checked={row.enabled} disabled={busy} label={`${copy.show}: ${row.name}`} onChange={(enabled) => save({ type: "competition", sportId: sport.id, name: row.name, enabled })} /></span>}
                          <span className="flex items-center gap-1.5">{copy.video}<Switch checked={row.video} disabled={busy} label={`${copy.video}: ${row.name}`} onChange={(video) => save({ type: "competition", sportId: sport.id, name: row.name, video })} /></span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {rows.length > PAGE && <p className="mt-2 text-xs text-ink-3">{copy.narrow.replace("{shown}", String(PAGE)).replace("{count}", String(rows.length))}</p>}
                </details>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
