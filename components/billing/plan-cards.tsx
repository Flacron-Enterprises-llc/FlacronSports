"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"
import { billingMessage, startCheckout } from "@/lib/billing-client"
import { annualSavingPercent, PLAN_HIGHLIGHTS } from "@/lib/billing/matrix"
import { PLANS, type BillingInterval, type PaidPlanId, type PlanId } from "@/lib/billing/plans"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

/** With `onPick` the card changes an existing subscription instead of opening checkout. */
export function PlanCards({ onPick, currentInterval }: { onPick?: (plan: PaidPlanId, interval: BillingInterval) => void; currentInterval?: BillingInterval | null }) {
  const { locale, t, href } = useLocale()
  const user = useAuthUser()
  const [interval, setInterval] = useState<BillingInterval>("monthly")
  const [pending, setPending] = useState<PaidPlanId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<PlanId | null>(null)

  useEffect(() => {
    if (!user) return setCurrent(null)
    authFetch("/api/billing/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setCurrent(data?.plan ?? null))
      .catch(() => setCurrent(null))
  }, [user])

  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value)

  const buy = async (plan: PaidPlanId) => {
    setPending(plan)
    setError(null)
    try {
      await startCheckout({ plan, interval })
    } catch (failure) {
      setError(billingMessage((failure as { code?: string }).code, t))
      setPending(null)
    }
  }

  return (
    <div>
      <div role="group" aria-label={t.pricing.compare} className="mx-auto mb-8 flex w-fit gap-1 rounded-lg border border-line bg-surface p-1">
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => setInterval(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${interval === value ? "bg-navy text-white" : "text-ink-2 hover:text-ink"}`}
          >
            {t.pricing[value]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {(["basic", "plus", "premium"] as const).map((id) => {
          const plan = PLANS[id]
          const price = interval === "monthly" ? plan.monthlyPriceUsd : plan.annualPriceUsd
          const featured = id === "plus"
          const saving = interval === "annual" ? annualSavingPercent(id) : null
          return (
            <section key={id} aria-labelledby={`plan-${id}`} className={`flex flex-col rounded-2xl border bg-surface p-6 shadow-[var(--shadow-md)] ${featured ? "border-orange" : "border-line"}`}>
              <h2 id={`plan-${id}`} className="text-xl font-semibold text-ink">{plan.name}</h2>
              <p className="mt-3">
                <span className="tabular font-display text-4xl font-bold text-ink">{money(price)}</span>
                <span className="text-ink-2">{interval === "monthly" ? t.pricing.perMonth : t.pricing.perYear}</span>
              </p>
              {saving !== null && <p className="mt-2 text-sm font-semibold text-good">{t.pricing.save.replace("{percent}", String(saving))}</p>}
              <p className="mt-2 text-xs leading-5 text-ink-2">
                {interval === "monthly" ? t.pricing.billedMonthly : t.pricing.billedAnnual} {t.pricing.tax}
              </p>
              <ul className="my-6 flex-1 space-y-2.5 text-sm text-ink-2">
                {PLAN_HIGHLIGHTS[id].map((benefit) => (
                  <li key={benefit.en} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-good" />
                    {benefit[locale]}
                  </li>
                ))}
              </ul>
              {current === id && (!onPick || !currentInterval || currentInterval === interval) ? (
                <p className="rounded-md border border-line py-2 text-center text-sm font-semibold text-ink-2">{t.pricing.current}</p>
              ) : onPick ? (
                <button type="button" onClick={() => onPick(id, interval)} className="rounded-md bg-orange py-2 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover">{`${t.pricing.choose} ${plan.name}`}</button>
              ) : user ? (
                <button type="button" disabled={pending !== null} onClick={() => buy(id)} className="rounded-md bg-orange py-2 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover disabled:opacity-60">
                  {pending === id ? t.pricing.opening : `${t.pricing.choose} ${plan.name}`}
                </button>
              ) : (
                <Link href={href(`/signup?plan=${id}&interval=${interval}`)} className="rounded-md bg-orange py-2 text-center text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover">
                  {t.pricing.choose} {plan.name}
                </Link>
              )}
            </section>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-4 text-center text-sm text-bad">{error}</p>}
    </div>
  )
}
