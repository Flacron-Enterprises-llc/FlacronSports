"use client"

import { Lock } from "lucide-react"
import { PlanCards } from "@/components/billing/plan-cards"
import { AppPage, PageHeader } from "@/components/site/states"
import { addonOpensPath, type AccessAddon } from "@/lib/billing/addons"
import type { PlanId } from "@/lib/billing/plans"
import { useLocale } from "@/lib/use-locale"
import { useAccount } from "./account-context"
import { ErrorNotice } from "./controls"

// A member with no plan still has to reach these to pay, confirm a payment or manage the account.
const OPEN_PATHS = [/^\/app\/billing/, /^\/app\/payment-success/, /^\/app\/settings/]

/**
 * member: the full dashboard. account: an open page, with no dashboard around it.
 * plans: choose a plan. checking: not known yet, so nothing of the dashboard shows.
 * failed: a read failed, which must not tell a paying member to subscribe again.
 */
export type ShellState = "member" | "account" | "plans" | "checking" | "failed"

export function shellState(input: { path: string; role: string | null; loaded: boolean; hasAccess: boolean; plan: PlanId; addons: AccessAddon[] }): ShellState {
  const { path, role, loaded, hasAccess, plan, addons } = input
  // Paying comes before the dashboard for everyone, so the confirmation stays outside it.
  if (/^\/app\/payment-success/.test(path)) return "account"
  if (role) return "member"
  if (!loaded) return "checking"
  if (!hasAccess) return "failed"
  if (plan !== "none" || addonOpensPath(path, addons)) return "member"
  return OPEN_PATHS.some((pattern) => pattern.test(path)) ? "account" : "plans"
}

export function useShellState(path: string): ShellState {
  const { access, addons, plan, role, loaded } = useAccount()
  return shellState({ path, role, loaded, hasAccess: access !== null, plan, addons })
}

/** The backend refuses every member API and render without a plan, so this is the explanation and not the lock. */
export function ChoosePlan() {
  const { t } = useLocale()
  return (
    <AppPage>
      <PageHeader title={t.paywall.title} lead={t.paywall.lead} icon={<Lock aria-hidden />} />
      <div id="plans"><PlanCards /></div>
    </AppPage>
  )
}

export function PlanCheckFailed() {
  const { t } = useLocale()
  const { reload } = useAccount()
  return <AppPage><ErrorNotice onRetry={() => void reload()}>{t.paywall.failed}</ErrorNotice></AppPage>
}
