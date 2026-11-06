"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Bot, Gauge, LoaderCircle, RefreshCw, Send, Sparkles } from "lucide-react"
import { AddonOffers } from "@/components/billing/addon-offers"
import { useAccount } from "@/components/dashboard/account-context"
import { btn, Meter, Notice, Panel, Skeleton } from "@/components/site/states"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import type { AssistantAnswer } from "@/lib/assistant/engine"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

interface Turn {
  id: number
  question: string
  answer?: AssistantAnswer
  error?: string
  exhausted?: boolean
}

function AnswerBody({ answer }: { answer: AssistantAnswer }) {
  const { locale, t, href } = useLocale()
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  return (
    <>
      <p className="leading-7 text-ink">{answer.text}</p>
      {answer.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {answer.items.map((item) => (
            <li key={item.matchId} className="rounded-lg border border-line bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Link href={href(`/app/match/${item.matchId}`)} className="min-w-0 font-semibold text-hot-text hover:underline">{item.title}</Link>
                {item.score && <SpoilerGuard label={t.spoiler.reveal}><span className="tabular font-semibold text-ink">{item.score}</span></SpoilerGuard>}
              </div>
              <p className="mt-0.5 text-ink-2">{item.competition} · {t.status[item.status]}{item.startUTC && <> · <LocalTime iso={item.startUTC} mode="datetime" /></>}</p>
            </li>
          ))}
        </ul>
      )}
      {answer.table && (
        <SpoilerGuard label={t.spoiler.reveal}>
          <table className="mt-3 w-full rounded-lg border border-line bg-surface text-sm">
            <caption className="px-3 pt-2 text-left text-ink-2">{answer.table.league}{answer.table.season ? ` · ${answer.table.season}` : ""}</caption>
            <thead>
              <tr className="text-left text-xs text-ink-2">
                <th scope="col" className="px-3 py-1.5 font-medium">{t.standings.rank}</th>
                <th scope="col" className="py-1.5 font-medium">{t.standings.team}</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">{t.standings.played}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t.standings.points}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {answer.table.rows.map((row) => (
                <tr key={row.team} className={row.asked ? "font-semibold text-ink" : "text-ink-2"}>
                  <td className="tabular px-3 py-1.5">{row.rank ?? t.standings.notSupplied}</td>
                  <td className="py-1.5">{row.team}</td>
                  <td className="tabular px-2 py-1.5 text-right">{row.played ?? t.standings.notSupplied}</td>
                  <td className="tabular px-3 py-1.5 text-right">{row.points ?? t.standings.notSupplied}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href={href(`/app/standings/${answer.table.leagueId}`)} className="mt-2 inline-block text-sm font-semibold text-hot-text hover:underline">{t.assistant.fullTable.replace("{total}", String(answer.table.total))}</Link>
        </SpoilerGuard>
      )}
      {answer.notes.map((note) => <p key={note} className="mt-2 text-sm text-ink-2">{note}</p>)}
      {answer.sources.length > 0 && (
        <p className="mt-3 text-xs text-ink-2">
          {t.feed.source}: {answer.sources.map((source) => (source.url ? <a key={source.label} className="underline" href={source.url} rel="noreferrer" target="_blank">{source.label}</a> : <span key={source.label}>{source.label}</span>))}
          {answer.asOfUTC && <> · {t.feed.updated} {date(answer.asOfUTC)}</>}
        </p>
      )}
    </>
  )
}

function Allowance() {
  const { locale, t } = useLocale()
  const { balance, dayPassEnd, loaded } = useAccount()
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  return (
    <Panel title={t.ui.assistantAllowance} icon={<Gauge aria-hidden />}>
      {balance ? (
        <>
          <p className="font-display text-[1.75rem] font-semibold leading-none text-ink">{balance.remaining}</p>
          <p className="mt-1 text-sm text-ink-2">{t.dash.requests}</p>
          <Meter value={balance.included.used} max={balance.included.limit} label={t.ui.assistantAllowance} className="mt-3" />
          <p className="mt-2 text-[13px] leading-5 text-ink-2">{t.assistant.remaining.replace("{included}", String(balance.included.remaining)).replace("{limit}", String(balance.included.limit)).replace("{purchased}", String(balance.purchased))}</p>
          {balance.credits.map((credit) => <p key={credit.purchaseId} className="mt-1 text-xs text-ink-2">{t.addons.items[credit.sku][0]}: {credit.remaining} · {t.assistant.expires} {date(credit.expiresAtUTC)}</p>)}
          {dayPassEnd && <p className="mt-1 text-sm text-ink-2">{t.assistant.dayPass} {date(dayPassEnd)}</p>}
        </>
      ) : !loaded ? (
        <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-7 w-16" /><Skeleton className="h-3 w-full" /></div>
      ) : (
        <p className="text-sm text-ink-2">{t.account.failed}</p>
      )}
    </Panel>
  )
}

export function AssistantPanel() {
  const { locale, t } = useLocale()
  const params = useSearchParams()
  const { setBalance, reload } = useAccount()
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const addon = params?.get("addon")

  useEffect(() => {
    if (addon !== "success") return
    const timer = setTimeout(() => void reload(), 4000)
    return () => clearTimeout(timer)
  }, [addon, reload])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" })
  }, [turns, busy])

  const ask = async (text: string, replace?: number) => {
    const asked = text.trim()
    if (asked.length < 2 || busy) return
    const id = replace ?? Date.now()
    setTurns((current) => (replace ? current.map((turn) => (turn.id === id ? { id, question: asked } : turn)) : [...current, { id, question: asked }]))
    setQuestion("")
    setBusy(true)
    const response = await authFetch("/api/assistant", { method: "POST", body: JSON.stringify({ question: asked, locale }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    const update: Partial<Turn> = response?.ok
      ? { answer: data.answer }
      : { error: data?.code === "allowance_exhausted" ? t.assistant.exhausted : data?.code === "email_not_verified" ? t.auth.notYet : t.assistant.failed, exhausted: data?.code === "allowance_exhausted" }
    if (response?.ok) setBalance(data.balance)
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)))
    setBusy(false)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        {addon === "success" && <Notice tone="success" role="status">{t.addons.confirming}</Notice>}
        {addon === "canceled" && <Notice role="status">{t.account.checkoutCanceled}</Notice>}
        <section aria-label={t.assistant.title} className="fs-rise flex h-[min(68dvh,640px)] min-h-[420px] flex-col rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]">
          <div ref={log} role="log" aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {turns.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-brand shadow-[var(--shadow-sm)]"><Sparkles aria-hidden className="size-5" /></span>
                <h2 className="mt-4 text-base font-semibold text-ink">{t.ui.assistantHello}</h2>
                <ul className="mt-4 flex max-w-lg flex-wrap justify-center gap-2">
                  {t.ui.assistantTips.map((tip) => (
                    <li key={tip}><button type="button" onClick={() => ask(tip)} className="rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-muted hover:text-ink">{tip}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {turns.map((turn) => (
              <div key={turn.id} className="fs-panel-in space-y-3">
                <div className="flex justify-end">
                  <p className="fs-chat-user max-w-[85%] break-words rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6">{turn.question}</p>
                </div>
                <div className="flex gap-2.5">
                  <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-brand"><Bot className="size-4" /></span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface-muted px-4 py-3 text-sm">
                    {turn.answer && <AnswerBody answer={turn.answer} />}
                    {turn.error && (
                      <div role="alert">
                        <p className="leading-6 text-bad">{turn.error}</p>
                        {turn.exhausted ? (
                          <a href="#addons" className="mt-2 inline-block font-semibold text-hot-text underline">{t.addons.title}</a>
                        ) : (
                          <button type="button" onClick={() => ask(turn.question, turn.id)} className={btn("outline", "sm", "mt-2")}><RefreshCw aria-hidden className="size-3.5" />{t.common.retry}</button>
                        )}
                      </div>
                    )}
                    {!turn.answer && !turn.error && <p className="inline-flex items-center gap-2 text-ink-2"><LoaderCircle aria-hidden className="size-4 animate-spin" />{t.assistant.asking}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void ask(question) }} className="flex items-end gap-2 border-t border-line p-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t.assistant.question}</span>
              <textarea
                className="fs-input block max-h-32 resize-none px-3 py-2 text-sm"
                rows={1}
                required
                minLength={2}
                maxLength={300}
                placeholder={t.assistant.placeholder}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void ask(question)
                  }
                }}
              />
            </label>
            <button type="submit" disabled={busy || question.trim().length < 2} className={btn("primary", "md", "shrink-0")}>
              <Send aria-hidden className="size-4" /><span className="hidden sm:inline">{t.assistant.ask}</span><span className="sr-only sm:hidden">{t.assistant.ask}</span>
            </button>
          </form>
        </section>
      </div>
      <aside aria-label={t.ui.assistantAllowance} className="min-w-0 space-y-4">
        <Allowance />
        <AddonOffers compact />
      </aside>
    </div>
  )
}
