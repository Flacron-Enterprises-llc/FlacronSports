"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"
import { startCheckout } from "@/lib/billing-client"
import { PLANS, type BillingInterval, type PaidPlanId, type PlanId } from "@/lib/billing/plans"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

const TEST_BILLING = process.env.NEXT_PUBLIC_BILLING_MODE !== "live"

export function PlanCards() {
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
      setError(failure instanceof Error ? failure.message : t.account.failed)
      setPending(null)
    }
  }

  const benefits: Record<PlanId, string[]> = {
    free: locale === "fr"
      ? ["Scores et calendriers", "5 favoris", "Anglais et français"]
      : ["Scores and schedules", "5 favorites", "English and French"],
    plus: locale === "fr"
      ? ["Scores et calendriers", "Favoris illimités", "Sans publicité FlacronSport"]
      : ["Scores and schedules", "Unlimited favorites", "No FlacronSport display ads"],
    premium: locale === "fr"
      ? ["Tout le contenu de Plus", "Favoris illimités", "Sans publicité FlacronSport"]
      : ["Everything in Plus", "Unlimited favorites", "No FlacronSport display ads"],
  }

  return (
    <div>
      {TEST_BILLING && (
        <p role="status" className="mb-6 rounded-lg border border-line bg-surface p-3 text-center text-sm font-medium text-warn">{t.pricing.testBilling}</p>
      )}
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
        {(["free", "plus", "premium"] as const).map((id) => {
          const plan = PLANS[id]
          const price = interval === "monthly" ? plan.monthlyPriceUsd : plan.annualPriceUsd
          const featured = id === "plus"
          return (
            <section key={id} aria-labelledby={`plan-${id}`} className={`flex flex-col rounded-2xl border bg-surface p-6 shadow-[var(--shadow-md)] ${featured ? "border-orange" : "border-line"}`}>
              <h2 id={`plan-${id}`} className="text-xl font-semibold text-ink">{plan.name}</h2>
              <p className="mt-3">
                <span className="tabular font-display text-4xl font-bold text-ink">{money(price)}</span>
                <span className="text-ink-2">{interval === "monthly" ? t.pricing.perMonth : t.pricing.perYear}</span>
              </p>
              {id !== "free" && (
                <p className="mt-2 text-xs leading-5 text-ink-2">
                  {interval === "monthly" ? t.pricing.billedMonthly : t.pricing.billedAnnual} {t.pricing.tax}
                </p>
              )}
              <ul className="my-6 flex-1 space-y-2.5 text-sm text-ink-2">
                {benefits[id].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-good" />
                    {benefit}
                  </li>
                ))}
              </ul>
              {current === id ? (
                <p className="rounded-md border border-line py-2 text-center text-sm font-semibold text-ink-2">{t.pricing.current}</p>
              ) : id === "free" ? (
                <Link href={href(user ? "/dashboard" : "/signup")} className="rounded-md border border-line py-2 text-center text-sm font-semibold text-ink hover:bg-surface-muted">{t.pricing.free}</Link>
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
