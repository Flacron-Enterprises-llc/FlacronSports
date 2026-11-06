"use client"

import { Lock } from "lucide-react"
import { PlanCards } from "@/components/billing/plan-cards"
import { AppPage, PageHeader, Skeleton } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"
import { useAccount } from "./account-context"
import { ErrorNotice } from "./controls"

// A member with no plan still has to reach these to pay, confirm a payment or manage the account.
const OPEN_PATHS = [/^\/app\/billing/, /^\/app\/payment-success/, /^\/app\/settings/]

/**
 * What a signed-in account without a plan sees. The backend enforces the same rule
 * on every member API, so this screen is the explanation and not the lock.
 */
export function PaywallGate({ path, children }: { path: string; children: React.ReactNode }) {
  const { t } = useLocale()
  const { access, plan, role, loaded, reload } = useAccount()
  if (OPEN_PATHS.some((pattern) => pattern.test(path)) || role) return <>{children}</>
  if (!loaded) return <AppPage><div role="status" aria-label={t.ui.loading} className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full" /></div></AppPage>
  // A failed read must not tell a paying member to subscribe again.
  if (!access) return <AppPage><ErrorNotice onRetry={() => void reload()}>{t.paywall.failed}</ErrorNotice></AppPage>
  if (plan !== "none") return <>{children}</>
  return (
    <AppPage>
      <PageHeader title={t.paywall.title} lead={t.paywall.lead} icon={<Lock aria-hidden />} />
      <div id="plans"><PlanCards /></div>
    </AppPage>
  )
}
