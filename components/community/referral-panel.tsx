"use client"

import { useCallback, useEffect, useState } from "react"
import { Gift } from "lucide-react"
import { CopyButton, ErrorNotice } from "@/components/dashboard/controls"
import { Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

interface Summary {
  code: string
  points: number
  awards: number
  cap: number
  perAward: number
  pending: number
}

export function ReferralPanel() {
  const { t, href } = useLocale()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/referrals").catch(() => null)
    if (response?.ok) setSummary(await response.json())
    else setFailed(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const link = summary ? `${window.location.origin}${href(`/app/billing/invite/${summary.code}`)}` : ""
  const fill = (text: string) => text.replace("{points}", String(summary?.perAward ?? "")).replace("{cap}", String(summary?.cap ?? ""))

  return (
    <Panel title={t.community.referralTitle} description={t.community.referralLead} icon={<Gift aria-hidden />}>
      {failed && <ErrorNotice onRetry={load}>{t.community.loadFailed}</ErrorNotice>}
      {!summary && !failed && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
      {summary && (
        <>
          <label className="block text-sm font-medium text-ink">
            {t.community.referralLink}
            <input readOnly value={link} onFocus={(event) => event.target.select()} className="fs-input mt-1 h-10 px-3 text-sm" />
          </label>
          <div className="mt-2"><CopyButton value={link} label={t.community.copy} done={t.community.copied} /></div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-ink-2">{t.community.referralPoints}</dt><dd className="tabular font-semibold text-ink">{summary.points}</dd></div>
            <div><dt className="text-ink-2">{t.community.referralAwarded}</dt><dd className="tabular font-semibold text-ink">{summary.awards} / {summary.cap}</dd></div>
            <div><dt className="text-ink-2">{t.community.referralPending}</dt><dd className="tabular font-semibold text-ink">{summary.pending}</dd></div>
          </dl>
          <p className="mt-3 text-[13px] leading-5 text-ink-2">{fill(t.community.referralRules)}</p>
        </>
      )}
    </Panel>
  )
}
