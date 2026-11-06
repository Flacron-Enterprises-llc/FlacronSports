"use client"

import { useCallback, useEffect, useState } from "react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { ListSkeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

export const CARD = "rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]"
export const FIELD = "fs-input h-10 px-3 text-sm"

export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    setFailed(false)
    authFetch(path)
      .then(async (response) => {
        if (!response.ok) throw new Error("request failed")
        setData(await response.json())
      })
      .catch(() => setFailed(true))
  }, [path])
  useEffect(load, [load])
  return { data, failed, load, setData }
}

export function Status({ failed, loaded, onRetry }: { failed: boolean; loaded: boolean; onRetry(): void }) {
  const { t } = useLocale()
  if (failed) return <ErrorNotice onRetry={onRetry}>{t.admin.loadFailed}</ErrorNotice>
  return loaded ? null : <div role="status" aria-label={t.admin.loading}><ListSkeleton rows={3} /></div>
}

export function Fact({ label, value }: { label: string; value: string | number }) {
  return <div className={CARD}><dt className="text-sm text-ink-2">{label}</dt><dd className="mt-1 text-lg font-semibold text-ink tabular">{value}</dd></div>
}

export function useWhen() {
  const { locale } = useLocale()
  return (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
}

export function ReasonField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const { t } = useLocale()
  return <label className="block text-sm font-medium text-ink">{t.admin.reason}<input className={`mt-1 ${FIELD}`} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} /></label>
}
