"use client"

import { useCallback, useEffect, useState } from "react"
import { ScrollText, Search } from "lucide-react"
import { btn, EmptyState, Notice } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { AuditEntry } from "@/lib/admin/audit-log"
import { useLocale } from "@/lib/use-locale"
import { CARD, FIELD, ReasonField, Status, useWhen } from "./shared"

function RevokeInvite() {
  const { t } = useLocale()
  const copy = t.admin.community
  const [roomId, setRoomId] = useState("")
  const [reason, setReason] = useState("")
  const [notice, setNotice] = useState<string | null>(null)

  const revoke = async () => {
    if (reason.trim().length < 3) return setNotice(t.admin.reasonRequired)
    const response = await authFetch("/api/admin/moderation", { method: "POST", body: JSON.stringify({ action: "revoke_invite", roomId: roomId.trim(), reason }) }).catch(() => null)
    setNotice(response?.ok ? t.admin.done : response?.status === 404 ? copy.noRoom : t.admin.actionFailed)
  }

  return (
    <section className={`${CARD} space-y-3`}>
      <h3 className="text-sm font-semibold text-ink">{copy.revokeTitle}</h3>
      <p className="text-sm leading-6 text-ink-2">{copy.revokeHelp}</p>
      <label className="block text-sm font-medium text-ink">{copy.roomId}<input className={`mt-1 ${FIELD}`} maxLength={64} value={roomId} onChange={(e) => setRoomId(e.target.value)} /></label>
      <ReasonField value={reason} onChange={setReason} />
      {notice && <Notice role="status">{notice}</Notice>}
      <button type="button" className={btn("outline", "sm")} disabled={!roomId.trim()} onClick={revoke}>{copy.revoke}</button>
    </section>
  )
}

function AuditLog() {
  const { t } = useLocale()
  const copy = t.admin.community
  const when = useWhen()
  const [q, setQ] = useState("")
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const search = useCallback(async (text: string, before: string | null) => {
    setFailed(false)
    const params = new URLSearchParams({ q: text, ...(before ? { before } : {}) })
    const response = await authFetch(`/api/admin/audit?${params}`).catch(() => null)
    if (!response?.ok) return setFailed(true)
    const data = (await response.json()) as { entries: AuditEntry[]; next: string | null }
    setEntries((current) => (before ? [...(current ?? []), ...data.entries] : data.entries))
    setNext(data.next)
  }, [])

  useEffect(() => void search("", null), [search])

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">{copy.auditTitle}</h3>
      <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(q, null) }}>
        <label className="min-w-0 flex-1"><span className="sr-only">{copy.auditSearch}</span><input type="search" placeholder={copy.auditSearch} className={FIELD} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button type="submit" className={btn("navy", "sm", "min-h-10")}><Search aria-hidden className="size-4" />{t.reports.searchButton}</button>
      </form>
      <Status failed={failed} loaded={entries !== null} onRetry={() => void search(q, null)} />
      {entries?.length === 0 && !next && <EmptyState compact icon={<ScrollText aria-hidden />} title={copy.auditEmpty} />}
      {entries?.length === 0 && next && <p className="text-sm text-ink-2">{copy.auditKeepLooking}</p>}
      <ul className="space-y-2">
        {entries?.map((entry) => (
          <li key={entry.id} className={CARD}>
            <p className="break-words text-sm font-semibold text-ink">{entry.action}</p>
            <p className="break-all text-xs text-ink-3">{when(entry.at)} · {entry.actorUid}</p>
            {Object.keys(entry.detail ?? {}).length > 0 && <p className="mt-1 break-words text-xs text-ink-2">{Object.entries(entry.detail).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>}
          </li>
        ))}
      </ul>
      {next && <button type="button" className={btn("outline", "sm")} onClick={() => void search(q, next)}>{copy.auditMore}</button>}
    </section>
  )
}

export function CommunityTab() {
  return (
    <div className="space-y-6">
      <RevokeInvite />
      <AuditLog />
    </div>
  )
}
