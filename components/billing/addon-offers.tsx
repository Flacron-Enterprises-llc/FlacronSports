"use client"

import { useEffect, useState } from "react"
import { ShoppingBag } from "lucide-react"
import { btn, Panel } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { billingMessage } from "@/lib/billing-client"
import { ADDONS, type AddonSku } from "@/lib/billing/addons"
import { getOfferHandoff, trackGrowthEvent } from "@/lib/growth-engine"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

export function AddonOffers({ compact }: { compact?: boolean }) {
  const { locale, t } = useLocale()
  const [skus, setSkus] = useState<AddonSku[]>([])
  const user = useAuthUser()
  const [pending, setPending] = useState<AddonSku | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/billing/addons")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSkus(data?.skus ?? []))
      .catch(() => setSkus([]))
  }, [])

  if (skus.length === 0) return null

  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value)

  const buy = async (sku: AddonSku) => {
    setPending(sku)
    setError(null)
    const { fcgeRef } = getOfferHandoff()
    const response = await authFetch("/api/billing/addon", { method: "POST", body: JSON.stringify({ sku, fcgeRef }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (data?.url) {
      trackGrowthEvent("checkout_started", { sku })
      return window.location.assign(data.url)
    }
    setError(billingMessage(data?.code, t))
    setPending(null)
  }

  return (
    <Panel id="addons" title={t.addons.title} description={t.addons.lead} icon={<ShoppingBag aria-hidden />}>
      <ul className={cn("grid gap-2.5", !compact && "sm:grid-cols-2 xl:grid-cols-4")}>
        {skus.map((sku) => (
          <li key={sku} className={cn("fs-lift flex flex-col rounded-lg border border-line", compact ? "p-3" : "p-4")}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="min-w-0 text-sm font-semibold text-ink">{t.addons.items[sku][0]}</h3>
              <p className="tabular shrink-0 font-display text-[15px] font-semibold text-ink">{money(ADDONS[sku].priceUsd)}</p>
            </div>
            <p className={cn("mt-1 flex-1 leading-5 text-ink-2", compact ? "text-xs" : "text-[13px]")}>{t.addons.items[sku][1]}</p>
            {user && (
              <button type="button" disabled={pending !== null} onClick={() => buy(sku)} className={btn("outline", "sm", "mt-2.5 w-full")}>
                {pending === sku ? t.pricing.opening : t.addons.buy}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      <p className="mt-3 text-xs leading-5 text-ink-2">{t.addons.note} {t.pricing.tax}</p>
    </Panel>
  )
}
