"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Flag, Send, ShieldOff } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, Notice, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import type { ReportScope } from "@/lib/community/chat"
import type { Reaction } from "@/lib/community/engagement"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { BadgeList } from "./badge-list"
import { BlockedPeople } from "./blocked-people"
import { useCommunityGate } from "./community-gate"
import { MatchPoll, type PollView } from "./match-poll"
import { ModeratorTools } from "./moderator-tools"

interface Message {
  id: string
  displayName: string
  badges?: Badge[]
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
const REFRESH_MS = 30_000

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
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (after: string | null) => {
    const url = after ? `${path}?cursor=${encodeURIComponent(after)}` : path
    const response = await authFetch(url).catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFailed(false)
    const data = await response.json()
    setMessages((current) => (after ? [...current, ...data.messages] : data.messages))
    setCursor(data.nextCursor)
    if (scope === "match") setState({ locked: data.locked, notice: data.notice, poll: data.poll })
    setLoaded(true)
  }, [path, scope, t])

  useEffect(() => {
    load(null)
  }, [load, user])

  // New messages arrive without a reload. Skipped once older pages are open, so the list keeps its place.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine && messages.length <= 50) void load(null)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load, messages.length])

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
        <Notice className="mb-3" role="note" title={t.community.pinned}><span className="whitespace-pre-wrap break-words">{state.notice.text}</span></Notice>
      )}
      {state.poll && <MatchPoll matchId={scopeId} poll={state.poll} signedIn={Boolean(user)} intercept={gate.intercept} onChange={(poll) => setState((current) => ({ ...current, poll }))} />}
      {scope === "match" && <ModeratorTools matchId={scopeId} hasNotice={Boolean(state.notice)} pollOpen={Boolean(state.poll?.open)} onChange={() => load(null)} />}
      {state.locked ? (
        <Notice tone="warning" role="status">{t.community.locked}</Notice>
      ) : user ? (
        <form onSubmit={send}>
          <label className="block">
            <span className="sr-only">{t.community.message}</span>
            <textarea className="fs-input block resize-y px-3 py-2 text-sm" rows={2} required maxLength={500} placeholder={t.community.message} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="submit" disabled={busy} className={btn("navy", "sm")}><Send aria-hidden className="size-3.5" />{t.community.send}</button>
            <Link href={href("/community-guidelines")} className="text-xs font-semibold text-hot-text hover:underline">{t.community.guidelines}</Link>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-2">{t.community.signInToPost}</p>
      )}
      {gate.prompt}
      {notice && <p role="status" className="mt-2 text-sm text-ink">{notice}</p>}
      {failed && <div className="mt-3"><ErrorNotice onRetry={() => load(null)}>{t.community.loadFailed}</ErrorNotice></div>}
      {!loaded && !failed && <div role="status" aria-label={t.ui.loading} className="mt-3 space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}
      {loaded && messages.length === 0 && <p className="mt-3 text-sm text-ink-2">{t.community.noMessages}</p>}
      <ul className="mt-3 space-y-2">
        {messages.map((message) => {
          const live = !message.removed && !message.formerMember
          return (
            <li key={message.id} className={`fs-panel-in rounded-xl border p-3 text-sm ${message.mine ? "border-line-strong bg-surface-muted" : "border-line"}`}>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-ink-2"><span>{message.formerMember ? t.community.formerMember : message.displayName}</span><BadgeList badges={message.badges} /><span>· {time(message.createdAtUTC)}</span></p>
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
                      className={`min-h-6 rounded-full border px-2 py-0.5 text-xs transition-colors ${message.myReaction === reaction ? "border-hot-text bg-surface-muted text-ink" : "border-line text-ink-2 hover:bg-surface-muted"}`}
                    >
                      {EMOJI[reaction]}{message.reactions[reaction] ? ` ${message.reactions[reaction]}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {user && !message.mine && live && (
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                  <button type="button" aria-expanded={reporting === message.id} className="inline-flex min-h-6 items-center gap-1 font-semibold text-ink-2 hover:text-ink" onClick={() => setReporting(reporting === message.id ? null : message.id)}><Flag aria-hidden className="size-3" />{t.community.report}</button>
                  <button type="button" className="inline-flex min-h-6 items-center gap-1 font-semibold text-ink-2 hover:text-ink" onClick={() => flag("block", message.id)}><ShieldOff aria-hidden className="size-3" />{t.community.block}</button>
                  {reporting === message.id && REPORT_REASONS.map((reason) => (
                    <button key={reason} type="button" className="min-h-6 font-semibold text-hot-text hover:underline" onClick={() => flag("report", message.id, reason)}>{t.community.reportReasons[reason]}</button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {cursor && <button type="button" onClick={() => load(cursor)} className={btn("ghost", "sm", "mt-3")}>{t.community.older}</button>}
      {user && <BlockedPeople onChange={() => load(null)} />}
    </div>
  )
}
