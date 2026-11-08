"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type CookieCategory = "necessary" | "functional" | "analytics" | "advertising"

const KEY = "fs-consent"
// 2: Analytics now includes the Flacron Growth Engine, so returning visitors choose again.
const VERSION = 2

interface ConsentRecord {
  version: number
  categories: CookieCategory[]
  source: "banner" | "preferences" | "gpc"
  decidedAt: string
}

interface ConsentValue {
  ready: boolean
  bannerOpen: boolean
  preferencesOpen: boolean
  gpc: boolean
  gpcApplied: boolean
  categories: CookieCategory[]
  acceptAll(source: ConsentRecord["source"]): void
  rejectNonEssential(source: ConsentRecord["source"]): void
  save(categories: CookieCategory[]): void
  dismissBanner(): void
  openPreferences(): void
  closePreferences(): void
}

const ConsentContext = createContext<ConsentValue | null>(null)

function readRecord(): ConsentRecord | null {
  try {
    const record = JSON.parse(localStorage.getItem(KEY) ?? "null")
    return record?.version === VERSION ? record : null
  } catch {
    return null
  }
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [record, setRecord] = useState<ConsentRecord | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [gpc, setGpc] = useState(false)

  const persist = useCallback((categories: CookieCategory[], source: ConsentRecord["source"]) => {
    const next: ConsentRecord = { version: VERSION, categories, source, decidedAt: new Date().toISOString() }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable: the choice applies to this page view only */
    }
    setRecord(next)
    setPreferencesOpen(false)
  }, [])

  useEffect(() => {
    const signal = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    setGpc(signal)
    const stored = readRecord()
    if (stored) setRecord(stored)
    else if (signal) persist(["necessary"], "gpc")
    setReady(true)
  }, [persist])

  const value = useMemo<ConsentValue>(
    () => ({
      ready,
      bannerOpen: !record && !dismissed,
      preferencesOpen,
      gpc,
      gpcApplied: record?.source === "gpc",
      categories: record?.categories ?? ["necessary"],
      acceptAll: (source) => persist(["necessary", "functional", "analytics", "advertising"], source),
      rejectNonEssential: (source) => persist(["necessary"], source),
      save: (categories) => persist([...new Set<CookieCategory>(["necessary", ...categories])], "preferences"),
      dismissBanner: () => setDismissed(true),
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
    }),
    [ready, record, dismissed, preferencesOpen, gpc, persist],
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentValue {
  const value = useContext(ConsentContext)
  if (!value) throw new Error("useConsent must be used inside ConsentProvider")
  return value
}
