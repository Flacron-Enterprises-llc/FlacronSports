"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CreditCard, ExternalLink, Gauge, Sparkles } from "lucide-react"
import { useAccount } from "@/components/dashboard/account-context"
import { ErrorNotice, useConfirm } from "@/components/dashboard/controls"
import { AddonOffers } from "@/components/billing/addon-offers"
import { PlanCards } from "@/components/billing/plan-cards"
import { btn, Meter, Notice, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { billingMessage } from "@/lib/billing-client"
import type { EffectiveAccess } from "@/lib/billing/entitlements"
import { PLANS, type BillingInterval, type PaidPlanId } from "@/lib/billing/plans"
import { usePreferences } from "./prefs-provider"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

function StatusChip({ access }: { access: EffectiveAccess }) {
  const { t } = useLocale()
  const tone = access.state === "past_due" ? "fs-chip-live" : access.state === "canceling" ? "fs-chip-warn" : "fs-chip-good"
  const label = t.ui.planStates[access.state]
  return <span className={cn("rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", tone)}>{label}</span>
}

export function AccountPanel() {
  const { locale, t, href } = useLocale()
  const params = useSearchParams()
  const { user, access, balance, dayPassEnd, plan, loaded, reload } = useAccount()
  const { prefs } = usePreferences()
  const { confirm, dialog } = useConfirm()
  const [message, setMessage] = useState<{ text: string; tone: "success" | "danger" | "info" } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (params?.get("checkout") === "canceled") setMessage({ text: t.account.checkoutCanceled, tone: "info" })
  }, [params, t])

  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView()
  }, [])

  const date = (seconds: number) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(seconds * 1000))
  const stamp = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

  const post = useCallback(async (path: string, body?: unknown) => {
    setBusy(true)
    const response = await authFetch(path, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    setBusy(false)
    return { ok: Boolean(response?.ok), data }
  }, [])

  const setCancel = async (undo: boolean) => {
    if (!undo && !(await confirm(t.account.confirmCancel, true))) return
    const { ok, data } = await post("/api/billing/cancel", { undo })
    setMessage(ok ? { text: undo ? t.ui.renewalOn : t.account.canceled, tone: "success" } : { text: billingMessage(data?.code, t), tone: "danger" })
    if (ok) await reload()
  }

  const portal = async () => {
    const { data } = await post("/api/billing/portal")
    if (data?.url) window.location.assign(data.url)
    else setMessage({ text: billingMessage(data?.code, t), tone: "danger" })
  }

  const changePlan = async (next: PaidPlanId, interval: BillingInterval) => {
    if (!(await confirm(t.account.confirmChange))) return
    const { ok, data } = await post("/api/billing/change-plan", { plan: next, interval })
    setMessage(ok ? { text: t.account.changed, tone: "success" } : { text: billingMessage(data?.code, t), tone: "danger" })
    if (ok) await reload()
  }

  const paid = access !== null && access.plan !== "none"
  const limit = PLANS[plan].favoritesLimit
  const rooms = PLANS[plan].privateRooms

  return (
    <div className="space-y-4">
      {dialog}
      {message && <Notice tone={message.tone} role="status">{message.text}</Notice>}
      {access?.state === "past_due" && <Notice tone="danger" role="alert" action={<button type="button" onClick={portal} className={btn("outline", "sm")}>{t.account.manage}</button>}>{t.account.pastDue}</Notice>}
      {loaded && !access && <ErrorNotice onRetry={reload}>{t.account.failed}</ErrorNotice>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="flex flex-col" title={t.account.plan} icon={<CreditCard aria-hidden />} actions={access && access.plan !== "none" ? <StatusChip access={access} /> : undefined}>
          {access ? <p className="font-display text-[2rem] font-bold leading-none text-ink">{access.plan === "none" ? t.paywall.noPlan : PLANS[access.plan].name}</p> : !loaded ? <Skeleton className="h-8 w-32" /> : null}
          <p className="mt-2 truncate text-sm text-ink-2">{user?.email}</p>
          {paid && access.currentPeriodEnd && <p className="mt-1 text-sm text-ink-2">{access.cancelAtPeriodEnd ? t.account.ends : t.account.renews} {date(access.currentPeriodEnd)}</p>}
          {paid && access.interval && <p className="mt-1 text-sm text-ink-2">{t.pricing[access.interval]}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {paid ? (
              <>
                <button type="button" disabled={busy} onClick={portal} className={btn("navy")}><ExternalLink aria-hidden className="size-4" />{t.account.manage}</button>
                <button type="button" disabled={busy} onClick={() => setCancel(access.cancelAtPeriodEnd)} className={btn("outline")}>{access.cancelAtPeriodEnd ? t.account.undo : t.account.cancel}</button>
              </>
            ) : loaded ? (
              <Link href={href("/app/billing#plans")} className={btn("primary")}><Sparkles aria-hidden className="size-4" />{t.account.choose}</Link>
            ) : null}
          </div>
        </Panel>

        <Panel className="h-full" title={t.ui.usage} description={t.ui.usageLead} icon={<Gauge aria-hidden />}>
          {balance ? (
            <dl className="space-y-4 text-sm">
              <div>
                <div className="flex justify-between gap-3"><dt className="text-ink-2">{t.ui.assistantAllowance}</dt><dd className="tabular font-semibold text-ink">{balance.included.used} / {balance.included.limit}</dd></div>
                <Meter value={balance.included.used} max={balance.included.limit} label={t.ui.assistantAllowance} className="mt-1.5" />
              </div>
              {limit !== null && (
                <div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-2">{t.nav.myTeams}</dt><dd className="tabular font-semibold text-ink">{prefs.favorites.length} / {limit}</dd></div>
                  <Meter value={prefs.favorites.length} max={limit} label={t.nav.myTeams} className="mt-1.5" />
                </div>
              )}
              {rooms && <div className="flex justify-between gap-3"><dt className="text-ink-2">{t.dash.rooms}</dt><dd className="tabular font-semibold text-ink">{t.ui.roomAllowance.replace("{active}", String(rooms.active)).replace("{people}", String(rooms.participantsPerRoom))}</dd></div>}
              {balance.credits.map((credit) => (
                <div key={credit.purchaseId} className="flex justify-between gap-3">
                  <dt className="min-w-0 text-ink-2">{t.addons.items[credit.sku][0]}<span className="block text-xs">{t.assistant.expires} {stamp(credit.expiresAtUTC)}</span></dt>
                  <dd className="tabular font-semibold text-ink">{credit.remaining}</dd>
                </div>
              ))}
              {dayPassEnd && <p className="text-ink-2">{t.assistant.dayPass} {stamp(dayPassEnd)}</p>}
            </dl>
          ) : !loaded ? (
            <div role="status" aria-label={t.ui.loading} className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
          ) : (
            <p className="text-sm text-ink-2">{t.account.failed}</p>
          )}
        </Panel>
      </div>

      {access?.state !== "past_due" && (
        <section id="plans" aria-labelledby="plans-title" className="scroll-mt-24">
          <h2 id="plans-title" className="mb-4 text-[17px] font-semibold text-ink">{paid ? t.account.changePlan : t.ui.choosePlan}</h2>
          <PlanCards onPick={paid ? changePlan : undefined} currentInterval={access?.interval} />
          <p className="mt-4 text-xs leading-5 text-ink-2">{t.pricing.disclaimer}</p>
        </section>
      )}

      <AddonOffers />
    </div>
  )
}
