"use client"

import { useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { ADDONS, type AddonSku } from "@/lib/billing/addons"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

export function AddonOffers({ skus }: { skus: AddonSku[] }) {
  const { locale, t } = useLocale()
  const user = useAuthUser()
  const [pending, setPending] = useState<AddonSku | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (skus.length === 0) return null

  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value)

  const buy = async (sku: AddonSku) => {
    setPending(sku)
    setError(null)
    const response = await authFetch("/api/billing/addon", { method: "POST", body: JSON.stringify({ sku }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (data?.url) return window.location.assign(data.url)
    setError(data?.error ?? t.account.failed)
    setPending(null)
  }

  return (
    <section aria-labelledby="addons" className="mt-10">
      <h2 id="addons" className="text-xl font-bold text-ink">{t.addons.title}</h2>
      <p className="mt-1 text-sm leading-6 text-ink-2">{t.addons.lead}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {skus.map((sku) => (
          <li key={sku} className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <h3 className="font-semibold text-ink">{t.addons.items[sku][0]}</h3>
            <p className="mt-1 text-lg font-semibold text-ink tabular">{money(ADDONS[sku].priceUsd)}</p>
            <p className="mt-1 flex-1 text-sm leading-6 text-ink-2">{t.addons.items[sku][1]}</p>
            {user && (
              <button type="button" disabled={pending !== null} onClick={() => buy(sku)} className="mt-3 rounded-md bg-orange py-2 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover disabled:opacity-60">
                {pending === sku ? t.pricing.opening : t.addons.buy}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      <p className="mt-3 text-xs leading-5 text-ink-2">{t.addons.note} {t.pricing.tax}</p>
    </section>
  )
}
