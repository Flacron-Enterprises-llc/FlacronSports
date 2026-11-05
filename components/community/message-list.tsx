"use client"

import { useCallback, useEffect, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import type { ReportScope } from "@/lib/community/chat"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

interface Message {
  id: string
  displayName: string
  text: string
  createdAtUTC: string
  removed: boolean
  mine: boolean
}

const ERRORS: Record<string, "slowMode" | "streamLink" | "tooLong" | "locked" | "sanctioned" | "expired"> = {
  slow_mode: "slowMode",
  stream_link_rejected: "streamLink",
  message_too_long: "tooLong",
  room_locked: "locked",
  sanctioned: "sanctioned",
  room_expired: "expired",
}

export function MessageList({ scope, scopeId, path }: { scope: ReportScope; scopeId: string; path: string }) {
  const { locale, t } = useLocale()
  const user = useAuthUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (after: string | null) => {
    const url = after ? `${path}?cursor=${encodeURIComponent(after)}` : path
    const response = await authFetch(url).catch(() => null)
    if (!response?.ok) return setNotice(t.community.loadFailed)
    const data = await response.json()
    setMessages((current) => (after ? [...current, ...data.messages] : data.messages))
    setCursor(data.nextCursor)
    setLoaded(true)
  }, [path, t])

  useEffect(() => {
    load(null)
  }, [load, user])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    const response = await authFetch(path, { method: "POST", body: JSON.stringify({ text }) }).catch(() => null)
    if (response?.ok) {
      setText("")
      await load(null)
    } else {
      const data = await response?.json().catch(() => null)
      setNotice(t.community[ERRORS[data?.code] ?? "sendFailed"])
    }
    setBusy(false)
  }

  const flag = async (kind: "report" | "block", messageId: string) => {
    const body = { scope, scopeId, messageId, ...(kind === "report" ? { reason: "abuse" } : {}) }
    const response = await authFetch(`/api/community/${kind}`, { method: "POST", body: JSON.stringify(body) }).catch(() => null)
    setNotice(response?.ok ? t.community[kind === "report" ? "reported" : "blocked"] : t.community.sendFailed)
    if (response?.ok && kind === "block") await load(null)
  }

  const time = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))

  return (
    <div>
      {user ? (
        <form onSubmit={send}>
          <label className="block text-sm font-medium text-ink">
            {t.community.message}
            <textarea className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" rows={2} required maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button type="submit" disabled={busy} className="mt-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">{t.community.send}</button>
        </form>
      ) : (
        <p className="text-sm text-ink-2">{t.community.signInToPost}</p>
      )}
      {notice && <p role="status" className="mt-2 text-sm text-ink">{notice}</p>}
      {loaded && messages.length === 0 && <p className="mt-3 text-sm text-ink-2">{t.community.noMessages}</p>}
      <ul className="mt-3 space-y-2">
        {messages.map((message) => (
          <li key={message.id} className="rounded-lg border border-line p-3 text-sm">
            <p className="text-xs text-ink-3">{message.displayName} · {time(message.createdAtUTC)}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-ink">{message.removed ? t.community.removed : message.text}</p>
            {user && !message.mine && !message.removed && (
              <div className="mt-1 flex gap-3 text-xs">
                <button type="button" className="font-semibold text-ink-2 hover:text-ink" onClick={() => flag("report", message.id)}>{t.community.report}</button>
                <button type="button" className="font-semibold text-ink-2 hover:text-ink" onClick={() => flag("block", message.id)}>{t.community.block}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {cursor && <button type="button" onClick={() => load(cursor)} className="mt-3 text-sm font-semibold text-hot-text hover:underline">{t.community.older}</button>}
    </div>
  )
}
