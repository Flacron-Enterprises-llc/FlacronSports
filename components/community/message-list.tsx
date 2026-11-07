"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Flag, Send, ShieldOff, SmilePlus } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, Initials, Notice, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import type { ReportScope } from "@/lib/community/chat"
import type { Reaction } from "@/lib/community/engagement"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { BadgeList } from "./badge-list"
import { BlockedPeople } from "./blocked-people"
import { useCommunityGate } from "./community-gate"
import { MatchPoll, type PollView } from "./match-poll"
import { ModeratorTools } from "./moderator-tools"
import { NameSetup } from "./name-setup"

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
  participants: number
  notice: { text: string } | null
  poll: PollView | null
}

const ERRORS: Record<string, "slowMode" | "streamLink" | "tooLong" | "locked" | "sanctioned" | "expired" | "tooFast" | "feedDown"> = {
  slow_mode: "slowMode",
  stream_link_rejected: "streamLink",
  message_too_long: "tooLong",
  room_locked: "locked",
  sanctioned: "sanctioned",
  room_expired: "expired",
  rate_limited: "tooFast",
  feed_unavailable: "feedDown",
}

const EMOJI: Record<Reaction, string> = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", fire: "🔥", sad: "😢" }
const REACTIONS = Object.keys(EMOJI) as Reaction[]
const REPORT_REASONS = ["spam", "abuse", "illegal_stream", "other"] as const
const REFRESH_MS = 10_000

function withReaction(message: Message, next: Reaction | null): Message {
  const reactions = { ...message.reactions }
  if (message.myReaction) reactions[message.myReaction] = Math.max(0, (reactions[message.myReaction] ?? 0) - 1)
  if (next) reactions[next] = (reactions[next] ?? 0) + 1
  return { ...message, reactions, myReaction: next }
}

/** `closed` says why this list can be read but no longer written to. */
export function MessageList({ scope, scopeId, path, closed = null }: { scope: ReportScope; scopeId: string; path: string; closed?: string | null }) {
  const { locale, t, href } = useLocale()
  const user = useAuthUser()
  const gate = useCommunityGate()
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<ChatState>({ locked: false, participants: 0, notice: null, poll: null })
  const [cursor, setCursor] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)
  const [tools, setTools] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (after: string | null) => {
    const url = after ? `${path}?cursor=${encodeURIComponent(after)}` : path
    const response = await authFetch(url).catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFailed(false)
    const data = await response.json()
    setMessages((current) => (after ? [...current, ...data.messages] : data.messages))
    setCursor(data.nextCursor)
    if (scope === "match") setState({ locked: data.locked, participants: data.participants, notice: data.notice, poll: data.poll })
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

  const canAct = Boolean(user) && !gate.locked && !closed
  const pollAsks = Boolean(state.poll?.open && state.poll.myVote === null)
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))

  return (
    <div>
      {state.notice && (
        <Notice className="mb-3" role="note" title={t.community.pinned}><span className="whitespace-pre-wrap break-words">{state.notice.text}</span></Notice>
      )}
      {state.participants > 0 && <p data-testid="chat-participants" className="mb-2 text-xs font-medium text-ink-2">{t.community.takingPart.replace("{count}", String(state.participants))}</p>}
      {state.poll && <MatchPoll matchId={scopeId} poll={state.poll} signedIn={Boolean(user)} locked={gate.locked} prompt={gate.prompt} intercept={gate.intercept} onChange={(poll) => setState((current) => ({ ...current, poll }))} />}
      {scope === "match" && <ModeratorTools matchId={scopeId} hasNotice={Boolean(state.notice)} pollOpen={Boolean(state.poll?.open)} onChange={() => load(null)} />}
      {closed ? (
        <Notice tone="warning" role="status">{closed}</Notice>
      ) : state.locked ? (
        <Notice tone="warning" role="status">{t.community.locked}</Notice>
      ) : user && gate.locked ? (
        !pollAsks && gate.prompt
      ) : user ? (
        <>
        <NameSetup user={user} />
        <form onSubmit={send} data-testid="chat-composer">
          <div className="fs-joined items-end rounded-2xl">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">{t.community.message}</span>
              <textarea className="block w-full resize-none px-3.5 py-2.5 text-sm" rows={2} required maxLength={500} placeholder={t.community.message} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <button type="submit" disabled={busy} className={btn("navy", "sm", "m-1.5 shrink-0 rounded-xl")}><Send aria-hidden className="size-3.5" /><span className="max-sm:sr-only">{t.community.send}</span></button>
          </div>
          <div className="mt-1 flex justify-end">
            <Link href={href("/community-guidelines")} className="inline-flex min-h-10 items-center text-xs font-semibold text-hot-text hover:underline sm:min-h-6">{t.community.guidelines}</Link>
          </div>
        </form>
        </>
      ) : (
        <p className="text-sm text-ink-2">{t.community.signInToPost}</p>
      )}
      {notice && <p role="status" className="mt-2 text-sm text-ink">{notice}</p>}
      {failed && <div className="mt-3"><ErrorNotice onRetry={() => load(null)}>{t.community.loadFailed}</ErrorNotice></div>}
      {!loaded && !failed && (
        <div role="status" aria-label={t.ui.loading} className="mt-3 space-y-3">
          <div className="flex gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-14 w-2/3 rounded-2xl" /></div>
          <div className="flex flex-row-reverse gap-2"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-10 w-1/2 rounded-2xl" /></div>
        </div>
      )}
      {loaded && messages.length === 0 && <p data-testid="chat-empty" className="mt-3 rounded-xl bg-surface-muted px-4 py-3 text-center text-sm text-ink-2">{t.community.noMessages}</p>}
      <ul data-testid="chat-messages" className="mt-3 space-y-3">
        {messages.map((message) => {
          const live = !message.removed && !message.formerMember
          const open = tools === message.id
          const name = message.formerMember ? t.community.formerMember : message.displayName
          const counted = REACTIONS.filter((reaction) => message.reactions[reaction])
          const shown = open && canAct ? REACTIONS : counted
          return (
            <li key={message.id} className={cn("fs-message fs-panel-in flex gap-2", message.mine && "flex-row-reverse")}>
              <Initials name={name} mine={message.mine} className="mt-5" />
              <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%]", message.mine ? "items-end" : "items-start")}>
                <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-xs font-medium text-ink-2", message.mine && "justify-end")}><span className="font-semibold text-ink">{name}</span><BadgeList badges={message.badges} /><span>{time(message.createdAtUTC)}</span></p>
                <p className={cn("mt-1 max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6", message.mine ? "fs-bubble-mine rounded-tr-md" : "fs-bubble rounded-tl-md", !live && "italic opacity-80")}>{message.removed ? t.community.removed : message.formerMember ? t.community.formerMessage : message.text}</p>
                {live && (shown.length > 0 || canAct) && (
                  <div className={cn("mt-1 flex flex-wrap items-center gap-1", message.mine && "justify-end")} role="group" aria-label={t.community.reactions}>
                    {shown.map((reaction) => (
                      <button
                        key={reaction}
                        type="button"
                        disabled={!canAct}
                        aria-pressed={message.myReaction === reaction}
                        aria-label={t.community.reactionNames[reaction]}
                        onClick={() => react(message.id, reaction)}
                        className={cn("inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border px-2 text-xs transition-colors sm:min-h-6 sm:min-w-0 sm:py-0.5", message.myReaction === reaction ? "border-hot-text bg-surface-muted text-ink" : "border-line text-ink-2 hover:bg-surface-muted")}
                      >
                        {EMOJI[reaction]}{message.reactions[reaction] ? ` ${message.reactions[reaction]}` : ""}
                      </button>
                    ))}
                    {canAct && (
                      <button type="button" aria-expanded={open} aria-label={t.community.reactions} title={t.community.reactions} onClick={() => { setTools(open ? null : message.id); setReporting(null) }} className={cn("fs-bubble-tools inline-flex size-10 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-muted hover:text-ink sm:size-6", open && "opacity-100")}>
                        <SmilePlus aria-hidden className="size-4" />
                      </button>
                    )}
                  </div>
                )}
                {open && canAct && !message.mine && live && (
                  <div className="fs-panel-in mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <button type="button" aria-expanded={reporting === message.id} className="inline-flex min-h-10 items-center gap-1 font-semibold text-ink-2 hover:text-ink sm:min-h-6" onClick={() => setReporting(reporting === message.id ? null : message.id)}><Flag aria-hidden className="size-3" />{t.community.report}</button>
                    <button type="button" className="inline-flex min-h-10 items-center gap-1 font-semibold text-ink-2 hover:text-ink sm:min-h-6" onClick={() => flag("block", message.id)}><ShieldOff aria-hidden className="size-3" />{t.community.block}</button>
                    {reporting === message.id && REPORT_REASONS.map((reason) => (
                      <button key={reason} type="button" className="min-h-10 font-semibold text-hot-text hover:underline sm:min-h-6" onClick={() => flag("report", message.id, reason)}>{t.community.reportReasons[reason]}</button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {cursor && <button type="button" onClick={() => load(cursor)} className={btn("ghost", "sm", "mt-3")}>{t.community.older}</button>}
      {user && <BlockedPeople onChange={() => load(null)} />}
    </div>
  )
}
