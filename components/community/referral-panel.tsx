"use client"

import { useCallback, useEffect, useState } from "react"
import { Gift } from "lucide-react"
import { ErrorNotice, ShareLink } from "@/components/dashboard/controls"
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
            <ShareLink value={link} label={t.community.referralLink} copy={t.community.copy} copied={t.community.copied} />
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {([[t.community.referralPoints, summary.points], [t.community.referralAwarded, `${summary.awards} / ${summary.cap}`], [t.community.referralPending, summary.pending]] as const).map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-lg bg-surface-muted px-3 py-2">
                  <dt className="truncate text-xs text-ink-2">{label}</dt>
                  <dd className="tabular font-display text-lg font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-ink-2">{fill(t.community.referralRules)}</p>
        </>
      )}
    </Panel>
  )
}
