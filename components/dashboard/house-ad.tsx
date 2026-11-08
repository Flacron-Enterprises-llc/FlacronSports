"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { PLANS } from "@/lib/billing/plans"
import { useLocale } from "@/lib/use-locale"
import { useAccount } from "./account-context"

const DAY_MS = 86_400_000

/**
 * The FlacronSport display ad in the plan table. It is our own promotion, so it
 * loads nothing from an ad network and needs no tracking. Paid plans never see it.
 */
export function HouseAd() {
  const { t, href } = useLocale()
  const { plan, loaded } = useAccount()
  const [hidden, setHidden] = useState(false)
  const [index, setIndex] = useState<number | null>(null)

  useEffect(() => {
    setIndex(Math.floor(Date.now() / DAY_MS) % t.ads.items.length)
  }, [t.ads.items.length])

  if (!loaded || hidden || index === null || !PLANS[plan].displayAds) return null
  const [title, body] = t.ads.items[index]
  return (
    <aside aria-label={t.ads.label} className="mx-auto mb-4 mt-6 flex w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
      <div data-testid="house-ad" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface-muted px-4 py-3">
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{t.ads.label}</span>
        <p className="min-w-0 flex-1 text-sm text-ink-2"><span className="font-semibold text-ink">{title}</span> {body}</p>
        <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className="shrink-0 text-sm font-semibold text-hot-text hover:underline">{t.ads.cta}</Link>
        <button type="button" onClick={() => setHidden(true)} aria-label={t.ads.dismiss} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:text-ink"><X aria-hidden className="size-4" /></button>
      </div>
    </aside>
  )
}
