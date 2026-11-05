"use client"

import { useLocale } from "@/lib/use-locale"

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLocale()
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-ink">{t.common.error}</h1>
      <button type="button" onClick={reset} className="mt-5 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">{t.common.retry}</button>
    </main>
  )
}
