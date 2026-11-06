"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppPage, Skeleton } from "@/components/site/states"
import { claimRecovery, forgetRecovery } from "@/lib/member-cookie"
import { syncMemberCookie } from "@/lib/member-session"
import { useLocale } from "@/lib/use-locale"
import { useAccount } from "./account-context"
import { ErrorNotice } from "./controls"

const STUCK_AFTER_MS = 10_000

/**
 * What a page renders when the backend gave it no data. The paywall replaces this for an
 * account with no plan, so anyone who sees it should have data, and their token was
 * missing or out of date: renew it and render again.
 */
export function MemberDataPending() {
  const { t } = useLocale()
  const { user } = useAccount()
  const router = useRouter()
  const path = usePathname() ?? "/app"
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!claimRecovery(path)) return setStuck(true)
    let active = true
    let timer: ReturnType<typeof setTimeout>
    void syncMemberCookie(user).then((synced) => {
      if (!active) return
      if (!synced) return setStuck(true)
      router.refresh()
      timer = setTimeout(() => setStuck(true), STUCK_AFTER_MS)
    })
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user, path, router])

  const retry = async () => {
    if (!user) return
    forgetRecovery(path)
    setStuck(false)
    await syncMemberCookie(user, true)
    router.refresh()
  }

  return (
    <AppPage>
      {stuck
        ? <ErrorNotice onRetry={() => void retry()}>{t.paywall.failed}</ErrorNotice>
        : <div role="status" aria-label={t.ui.loading} className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full" /></div>}
    </AppPage>
  )
}
