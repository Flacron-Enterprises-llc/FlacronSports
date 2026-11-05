"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { authFetch } from "@/lib/auth-fetch"
import type { ReportScope } from "@/lib/community/chat"
import type { Reaction } from "@/lib/community/engagement"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { BlockedPeople } from "./blocked-people"
import { useCommunityGate } from "./community-gate"
import { MatchPoll, type PollView } from "./match-poll"
import { ModeratorTools } from "./moderator-tools"

interface Message {
  id: string
  displayName: string
  text: string
  createdAtUTC: string
  removed: boolean
  formerMember: boolean
  mine: boolean
  reactions: Partial<Record<Reaction, number>>
  myReaction: Reaction | null
}

interface ChatState {
  locked: boolean
  notice: { text: string } | null
  poll: PollView | null
}

const ERRORS: Record<string, "slowMode" | "streamLink" | "tooLong" | "locked" | "sanctioned" | "expired"> = {
  slow_mode: "slowMode",
  stream_link_rejected: "streamLink",
  message_too_long: "tooLong",
  room_locked: "locked",
  sanctioned: "sanctioned",
  room_expired: "expired",
}

const EMOJI: Record<Reaction, string> = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", fire: "🔥", sad: "😢" }
const REACTIONS = Object.keys(EMOJI) as Reaction[]
const REPORT_REASONS = ["spam", "abuse", "illegal_stream", "other"] as const

function withReaction(message: Message, next: Reaction | null): Message {
  const reactions = { ...message.reactions }
  if (message.myReaction) reactions[message.myReaction] = Math.max(0, (reactions[message.myReaction] ?? 0) - 1)
  if (next) reactions[next] = (reactions[next] ?? 0) + 1
  return { ...message, reactions, myReaction: next }
}

export function MessageList({ scope, scopeId, path }: { scope: ReportScope; scopeId: string; path: string }) {
  const { locale, t, href } = useLocale()
  const user = useAuthUser()
  const gate = useCommunityGate()
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<ChatState>({ locked: false, notice: null, poll: null })
  const [cursor, setCursor] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)

  const load = useCallback(async (after: string | null) => {
    const url = after ? `${path}?cursor=${encodeURIComponent(after)}` : path
    const response = await authFetch(url).catch(() => null)
    if (!response?.ok) return setNotice(t.community.loadFailed)
    const data = await response.json()
    setMessages((current) => (after ? [...current, ...data.messages] : data.messages))
    setCursor(data.nextCursor)
    if (scope === "match") setState({ locked: data.locked, notice: data.notice, poll: data.poll })
    setLoaded(true)
  }, [path, scope, t])

  useEffect(() => {
    load(null)
  }, [load, user])

  const post = async () => {
    setBusy(true)
    setNotice(null)
    const response = await authFetch(path, { method: "POST", body: JSON.stringify({ text }) }).catch(() => null)
    if (response?.ok) {
      setText("")
      await load(null)
    } else {
      const data = await response?.json().catch(() => null)
      if (!gate.intercept(data?.code, post)) setNotice(t.community[ERRORS[data?.code] ?? "sendFailed"])
    }
    setBusy(false)
  }

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    post()
  }

  const flag = async (kind: "report" | "block", messageId: string, reason?: string) => {
    setReporting(null)
    const body = { scope, scopeId, messageId, ...(reason ? { reason } : {}) }
    const response = await authFetch(`/api/community/${kind}`, { method: "POST", body: JSON.stringify(body) }).catch(() => null)
    if (!response?.ok) {
      const data = await response?.json().catch(() => null)
      if (!gate.intercept(data?.code, () => flag(kind, messageId, reason))) setNotice(t.community.sendFailed)
      return
    }
    setNotice(t.community[kind === "report" ? "reported" : "blocked"])
    if (kind === "block") await load(null)
  }

  const react = async (messageId: string, reaction: Reaction) => {
    const response = await authFetch("/api/community/react", { method: "POST", body: JSON.stringify({ scope, scopeId, messageId, reaction }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (response?.ok) setMessages((current) => current.map((message) => (message.id === messageId ? withReaction(message, data.reaction) : message)))
    else if (!gate.intercept(data?.code, () => react(messageId, reaction))) setNotice(t.community[ERRORS[data?.code] ?? "sendFailed"])
  }

  const time = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))

  return (
    <div>
      {state.notice && (
        <aside className="mb-3 rounded-lg border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-semibold text-ink-3">{t.community.pinned}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-ink">{state.notice.text}</p>
        </aside>
      )}
      {state.poll && <MatchPoll matchId={scopeId} poll={state.poll} signedIn={Boolean(user)} intercept={gate.intercept} onChange={(poll) => setState((current) => ({ ...current, poll }))} />}
      {scope === "match" && <ModeratorTools matchId={scopeId} hasNotice={Boolean(state.notice)} pollOpen={Boolean(state.poll?.open)} onChange={() => load(null)} />}
      {state.locked ? (
        <p className="text-sm text-ink-2">{t.community.locked}</p>
      ) : user ? (
        <form onSubmit={send}>
          <label className="block text-sm font-medium text-ink">
            {t.community.message}
            <textarea className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" rows={2} required maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="submit" disabled={busy} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">{t.community.send}</button>
            <Link href={href("/community-guidelines")} className="text-xs font-semibold text-hot-text hover:underline">{t.community.guidelines}</Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-2">{t.community.signInToPost}</p>
      )}
      {gate.prompt}
      {notice && <p role="status" className="mt-2 text-sm text-ink">{notice}</p>}
      {loaded && messages.length === 0 && <p className="mt-3 text-sm text-ink-2">{t.community.noMessages}</p>}
      <ul className="mt-3 space-y-2">
        {messages.map((message) => {
          const live = !message.removed && !message.formerMember
          return (
            <li key={message.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="text-xs text-ink-3">{message.formerMember ? t.community.formerMember : message.displayName} · {time(message.createdAtUTC)}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-ink">{message.removed ? t.community.removed : message.formerMember ? t.community.formerMessage : message.text}</p>
              {live && (
                <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={t.community.reactions}>
                  {REACTIONS.filter((reaction) => user || message.reactions[reaction]).map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      disabled={!user}
                      aria-pressed={message.myReaction === reaction}
                      aria-label={t.community.reactionNames[reaction]}
                      onClick={() => react(message.id, reaction)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${message.myReaction === reaction ? "border-hot-text bg-surface-muted text-ink" : "border-line text-ink-2 hover:bg-surface-muted"}`}
                    >
                      {EMOJI[reaction]}{message.reactions[reaction] ? ` ${message.reactions[reaction]}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {user && !message.mine && live && (
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <button type="button" aria-expanded={reporting === message.id} className="font-semibold text-ink-2 hover:text-ink" onClick={() => setReporting(reporting === message.id ? null : message.id)}>{t.community.report}</button>
                  <button type="button" className="font-semibold text-ink-2 hover:text-ink" onClick={() => flag("block", message.id)}>{t.community.block}</button>
                  {reporting === message.id && REPORT_REASONS.map((reason) => (
                    <button key={reason} type="button" className="font-semibold text-hot-text hover:underline" onClick={() => flag("report", message.id, reason)}>{t.community.reportReasons[reason]}</button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {cursor && <button type="button" onClick={() => load(cursor)} className="mt-3 text-sm font-semibold text-hot-text hover:underline">{t.community.older}</button>}
      {user && <BlockedPeople onChange={() => load(null)} />}
    </div>
  )
}
