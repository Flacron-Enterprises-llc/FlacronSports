"use client"

import { useEffect, useState } from "react"
import { ShoppingBag } from "lucide-react"
import { btn, Panel } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { billingMessage } from "@/lib/billing-client"
import { ADDONS, type AddonSku } from "@/lib/billing/addons"
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
    const response = await authFetch("/api/billing/addon", { method: "POST", body: JSON.stringify({ sku }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (data?.url) return window.location.assign(data.url)
    setError(billingMessage(data?.code, t))
    setPending(null)
  }

  return (
    <Panel id="addons" title={t.addons.title} description={t.addons.lead} icon={<ShoppingBag aria-hidden />}>
      <ul className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
        {skus.map((sku) => (
          <li key={sku} className="fs-lift flex flex-col rounded-lg border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">{t.addons.items[sku][0]}</h3>
            <p className="mt-1 text-lg font-semibold text-ink tabular">{money(ADDONS[sku].priceUsd)}</p>
            <p className="mt-1 flex-1 text-sm leading-6 text-ink-2">{t.addons.items[sku][1]}</p>
            {user && (
              <button type="button" disabled={pending !== null} onClick={() => buy(sku)} className={btn("outline", "md", "mt-3 w-full")}>
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
