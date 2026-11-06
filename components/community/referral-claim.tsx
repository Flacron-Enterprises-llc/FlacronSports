"use client"

import { useCallback, useEffect, useState } from "react"
import { PlanCards } from "@/components/billing/plan-cards"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Notice, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

type State = "working" | "done" | "refused" | "invalid" | "failed"

export function ReferralClaim({ code }: { code: string }) {
  const { t } = useLocale()
  const [state, setState] = useState<State>("working")

  const claim = useCallback(async () => {
    setState("working")
    const response = await authFetch("/api/referrals/claim", { method: "POST", body: JSON.stringify({ code }) }).catch(() => null)
    if (response?.ok) return setState("done")
    const data = await response?.json().catch(() => null)
    setState(data?.code === "referral_not_eligible" ? "refused" : data?.code === "invite_invalid" ? "invalid" : "failed")
  }, [code])

  useEffect(() => {
    void claim()
  }, [claim])

  return (
    <div className="space-y-5">
      {state === "working" && <div role="status" aria-label={t.ui.loading}><Skeleton className="h-14 w-full" /></div>}
      {state === "done" && <Notice tone="success" role="status">{t.community.inviteDone}</Notice>}
      {state === "refused" && <Notice role="status">{t.community.inviteRefused}</Notice>}
      {state === "invalid" && <Notice tone="warning" role="status">{t.community.referralInvalid}</Notice>}
      {state === "failed" && <ErrorNotice onRetry={claim}>{t.community.sendFailed}</ErrorNotice>}
      <div id="plans"><PlanCards /></div>
    </div>
  )
}
