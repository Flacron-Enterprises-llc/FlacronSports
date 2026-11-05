"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { usePreferences } from "@/components/account/prefs-provider"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

/** Raise this when steps change materially so people see the new tour once. */
export const TOUR_VERSION = 1
const START_EVENT = "fs-tour-start"

export function startTour() {
  window.dispatchEvent(new Event(START_EVENT))
}

interface Step {
  id: string
  /** Value of the data-tour attribute on a real element. */
  target: string
  route?: string
}

function visibleTarget(name: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  for (const element of candidates) {
    const box = element.getBoundingClientRect()
    if (box.width > 0 && box.height > 0) return element
  }
  return null
}

export function AppTour() {
  const { t, href } = useLocale()
  const { prefs, ready, signedIn, update } = usePreferences()
  const pathname = usePathname()
  const router = useRouter()
  const [index, setIndex] = useState<number | null>(null)
  const [plan, setPlan] = useState<string>("free")
  const [box, setBox] = useState<DOMRect | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  const steps = useMemo<Step[]>(() => {
    const base: Step[] = [
      { id: "scores", target: "/scores" },
      { id: "watch", target: "/watch" },
      { id: "teams", target: "/my-teams" },
    ]
    return [...base, { id: plan === "free" ? "upgrade" : "billing", target: plan === "free" ? "/pricing" : "account" }, { id: "settings", target: "account" }]
  }, [plan])

  useEffect(() => {
    if (!signedIn) return
    authFetch("/api/billing/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.plan && setPlan(data.plan))
      .catch(() => undefined)
  }, [signedIn])

  // First login only: completion is stored per user and never forced again.
  useEffect(() => {
    if (ready && signedIn && prefs.tourVersion < TOUR_VERSION) setIndex((current) => current ?? 0)
  }, [ready, signedIn, prefs.tourVersion])

  useEffect(() => {
    const start = () => setIndex(0)
    window.addEventListener(START_EVENT, start)
    return () => window.removeEventListener(START_EVENT, start)
  }, [])

  const step = index === null ? null : steps[index]

  const finish = useCallback(() => {
    setIndex(null)
    if (signedIn) void update({ tourVersion: TOUR_VERSION })
  }, [signedIn, update])

  useLayoutEffect(() => {
    if (!step) return
    const place = () => {
      const element = visibleTarget(step.target)
      if (!element) return setBox(null)
      setBox(element.getBoundingClientRect())
    }
    place()
    const timer = setTimeout(place, 200)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place)
    }
  }, [step, pathname])

  useEffect(() => {
    if (step) panel.current?.focus()
  }, [step])

  if (index === null || !step) return null

  const copy = t.tour.steps[step.id as keyof typeof t.tour.steps]
  const last = index === steps.length - 1
  const margin = 12
  const width = Math.min(340, typeof window === "undefined" ? 340 : window.innerWidth - margin * 2)
  const style: React.CSSProperties = box
    ? {
        width,
        left: Math.max(margin, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - margin)),
        ...(box.bottom + 220 < window.innerHeight ? { top: box.bottom + margin } : { bottom: window.innerHeight - box.top + margin }),
      }
    : { width, left: (typeof window === "undefined" ? 0 : window.innerWidth - width) / 2, top: 96 }

  return (
    <div className="fixed inset-0 z-[70]">
      <div aria-hidden className="absolute inset-0 bg-[#001a3f]/40" onClick={finish} />
      {box && <div aria-hidden className="pointer-events-none absolute rounded-lg ring-2 ring-orange" style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8 }} />}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") finish()
          if (event.key === "ArrowRight" && !last) setIndex(index + 1)
          if (event.key === "ArrowLeft" && index > 0) setIndex(index - 1)
        }}
        style={style}
        className="absolute rounded-xl border border-line bg-surface-raised p-4 shadow-[var(--shadow-lg)]"
      >
        <p className="text-xs font-medium text-ink-2">{index + 1} / {steps.length}</p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold text-ink">{copy[0]}</h2>
        <p id="tour-body" className="mt-1 text-sm leading-6 text-ink-2">{copy[1]}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="text-sm font-medium text-ink-2 hover:text-ink">{t.tour.skip}</button>
          <div className="flex gap-2">
            {index > 0 && <button type="button" onClick={() => setIndex(index - 1)} className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink">{t.tour.back}</button>}
            <button
              type="button"
              onClick={() => (last ? (finish(), step.id === "settings" && router.push(href("/settings"))) : setIndex(index + 1))}
              className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              {last ? t.tour.finish : t.tour.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
