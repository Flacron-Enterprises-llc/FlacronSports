"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { LocalTime } from "@/components/sports/parts"
import type { AssistantAnswer } from "@/lib/assistant/engine"
import { authFetch } from "@/lib/auth-fetch"
import type { AllowanceBalance } from "@/lib/billing/allowance"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

export function AssistantPanel() {
  const { locale, t, href } = useLocale()
  const user = useAuthUser()
  const params = useSearchParams()
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null)
  const [balance, setBalance] = useState<AllowanceBalance | null>(null)
  const [dayPassEnd, setDayPassEnd] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await authFetch("/api/assistant").catch(() => null)
    if (!response?.ok) return
    const data = await response.json()
    setBalance(data.balance)
    setDayPassEnd(data.dayPassExpiresAtUTC)
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const addon = params?.get("addon")

  const ask = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await authFetch("/api/assistant", { method: "POST", body: JSON.stringify({ question, locale }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (response?.ok) {
      setAnswer(data.answer)
      setBalance(data.balance)
    } else {
      setAnswer(null)
      setError(data?.code === "allowance_exhausted" ? t.assistant.exhausted : data?.code === "email_not_verified" ? t.auth.notYet : t.assistant.failed)
    }
    setBusy(false)
  }

  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

  return (
    <div className="space-y-5">
      {addon === "success" && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">{t.addons.confirming}</p>}
      {addon === "canceled" && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">{t.account.checkoutCanceled}</p>}

      {!user ? (
        <p className="text-ink-2">{t.auth.required} <Link className="font-semibold text-hot-text underline" href={href("/signin")}>{t.nav.signIn}</Link></p>
      ) : (
        <form onSubmit={ask} className="rounded-2xl border border-line bg-surface p-5">
          <label className="block text-sm font-medium text-ink">
            {t.assistant.question}
            <textarea className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" rows={2} required minLength={2} maxLength={300} placeholder={t.assistant.placeholder} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </label>
          <button type="submit" disabled={busy} className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">{busy ? t.assistant.asking : t.assistant.ask}</button>
          {balance && (
            <p className="mt-3 text-sm text-ink-2">
              {t.assistant.remaining.replace("{included}", String(balance.included.remaining)).replace("{limit}", String(balance.included.limit)).replace("{purchased}", String(balance.purchased))}
            </p>
          )}
          {balance?.credits.map((credit) => (
            <p key={credit.purchaseId} className="text-xs text-ink-2">{t.addons.items[credit.sku][0]}: {credit.remaining} · {t.assistant.expires} {date(credit.expiresAtUTC)}</p>
          ))}
          {dayPassEnd && <p className="mt-1 text-sm text-ink-2">{t.assistant.dayPass} {date(dayPassEnd)}</p>}
        </form>
      )}

      {error && <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-bad">{error}</p>}

      {answer && (
        <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-5">
          <p className="leading-7 text-ink">{answer.text}</p>
          {answer.items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {answer.items.map((item) => (
                <li key={item.matchId} className="rounded-lg border border-line p-3 text-sm">
                  <Link href={href(`/match/${item.matchId}`)} className="font-semibold text-hot-text hover:underline">{item.title}</Link>
                  {item.score && <span className="ml-2 font-semibold text-ink tabular">{item.score}</span>}
                  <p className="text-ink-2">{item.competition} · {t.status[item.status]}{item.startUTC && <> · <LocalTime iso={item.startUTC} mode="datetime" /></>}</p>
                </li>
              ))}
            </ul>
          )}
          {answer.notes.map((note) => <p key={note} className="mt-2 text-sm text-ink-2">{note}</p>)}
          {answer.sources.length > 0 && (
            <p className="mt-3 text-xs text-ink-3">
              {t.feed.source}: {answer.sources.map((source) => (source.url ? <a key={source.label} className="underline" href={source.url} rel="noreferrer" target="_blank">{source.label}</a> : source.label))}
              {answer.asOfUTC && <> · {t.feed.updated} {date(answer.asOfUTC)}</>}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
