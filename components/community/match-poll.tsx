"use client"

import { useState } from "react"
import { Meter } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

export interface PollView {
  question: string
  open: boolean
  options: { text: string; votes: number }[]
  myVote: number | null
}

export function MatchPoll({
  matchId, poll, signedIn, intercept, onChange,
}: {
  matchId: string
  poll: PollView
  signedIn: boolean
  intercept(code: string | undefined, action: () => void): boolean
  onChange(poll: PollView): void
}) {
  const { t } = useLocale()
  const [notice, setNotice] = useState<string | null>(null)
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0)
  const showResults = !poll.open || poll.myVote !== null || !signedIn

  const vote = async (option: number) => {
    setNotice(null)
    const response = await authFetch(`/api/matches/${matchId}/poll`, { method: "POST", body: JSON.stringify({ option }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (response?.ok) return onChange(data.poll)
    if (intercept(data?.code, () => vote(option))) return
    setNotice(data?.code === "already_voted" ? t.community.alreadyVoted : data?.code === "poll_closed" ? t.community.pollClosed : t.community.sendFailed)
  }

  return (
    <section aria-label={t.community.pollTitle} className="mb-3 rounded-xl border border-line p-3 text-sm">
      <p className="text-xs font-semibold text-ink-2">{t.community.pollTitle}</p>
      <p className="mt-1 font-semibold text-ink">{poll.question}</p>
      <ul className="mt-2 space-y-1.5">
        {poll.options.map((option, index) => (
          <li key={option.text} className="fs-panel-in">
            {showResults ? (
              <div className={poll.myVote === index ? "font-semibold text-ink" : "text-ink-2"}>
                <div className="flex justify-between gap-3"><span className="min-w-0">{option.text}</span><span className="tabular shrink-0">{total ? Math.round((option.votes / total) * 100) : 0}%</span></div>
                <Meter value={option.votes} max={Math.max(total, 1)} label={option.text} className="mt-1" />
              </div>
            ) : (
              <button type="button" onClick={() => vote(index)} className="min-h-9 w-full rounded-lg border border-line px-3 py-1.5 text-left font-medium text-ink transition-colors hover:bg-surface-muted">{option.text}</button>
            )}
          </li>
        ))}
      </ul>
      {!poll.open && <p className="mt-2 text-xs text-ink-3">{t.community.pollClosed}</p>}
      {notice && <p role="status" className="mt-2 text-ink">{notice}</p>}
    </section>
  )
}
