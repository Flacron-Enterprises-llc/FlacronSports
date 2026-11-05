"use client"

import { useEffect, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

const FIELD = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
const BUTTON = "rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-muted"

/** Shown to staff only for convenience. The moderation route checks the role and second factor. */
export function ModeratorTools({ matchId, hasNotice, pollOpen, onChange }: { matchId: string; hasNotice: boolean; pollOpen: boolean; onChange(): void }) {
  const { t } = useLocale()
  const user = useAuthUser()
  const [staff, setStaff] = useState(false)
  const [reason, setReason] = useState("")
  const [noticeText, setNoticeText] = useState("")
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    user?.getIdTokenResult().then((result) => setStaff(result.claims.role === "moderator" || result.claims.role === "admin")).catch(() => undefined)
  }, [user])

  if (!staff) return null

  const act = async (body: Record<string, unknown>) => {
    if (reason.trim().length < 3) return setStatus(t.admin.reasonRequired)
    const response = await authFetch("/api/admin/moderation", { method: "POST", body: JSON.stringify({ ...body, matchId, reason }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return setStatus(data?.code === "poll_open" ? t.community.closeCurrentPoll : t.admin.actionFailed)
    setStatus(t.admin.done)
    setNoticeText("")
    setQuestion("")
    setOptions("")
    onChange()
  }

  const lines = options.split("\n").map((line) => line.trim()).filter(Boolean)

  return (
    <details className="mb-3 rounded-lg border border-line p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-ink">{t.community.modTools}</summary>
      <div className="mt-3 space-y-3">
        <label className="block font-medium text-ink">{t.admin.reason}<input className={FIELD} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label className="block font-medium text-ink">{t.community.pinned}<textarea className={FIELD} rows={2} maxLength={500} value={noticeText} onChange={(e) => setNoticeText(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} disabled={!noticeText.trim()} onClick={() => act({ action: "pin_notice", text: noticeText })}>{t.community.pinNotice}</button>
          {hasNotice && <button type="button" className={BUTTON} onClick={() => act({ action: "clear_notice" })}>{t.community.clearNotice}</button>}
        </div>
        {pollOpen ? (
          <button type="button" className={BUTTON} onClick={() => act({ action: "close_poll" })}>{t.community.closePoll}</button>
        ) : (
          <>
            <label className="block font-medium text-ink">{t.community.pollQuestion}<input className={FIELD} maxLength={140} value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
            <label className="block font-medium text-ink">{t.community.pollOptions}<textarea className={FIELD} rows={4} value={options} onChange={(e) => setOptions(e.target.value)} /></label>
            <button type="button" className={BUTTON} disabled={!question.trim() || lines.length < 2 || lines.length > 4} onClick={() => act({ action: "create_poll", question, options: lines })}>{t.community.createPoll}</button>
          </>
        )}
        {status && <p role="status" className="text-ink">{status}</p>}
      </div>
    </details>
  )
}
