"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { AppPage, CardGridSkeleton, DetailSkeleton, ListSkeleton, Skeleton, StatRowSkeleton } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

export function BootLoader({ status, leaving = false }: { status: string; leaving?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-label={status} className={cn("fs-boot fixed inset-0 z-[90] flex flex-col items-center justify-center gap-7 bg-bg", leaving && "is-leaving")}>
      <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_60%)]" />
      <div className="relative size-24">
        <span aria-hidden className="fs-boot-pulse absolute inset-2 rounded-full" />
        <span aria-hidden className="fs-boot-ring absolute inset-0 rounded-full" />
        <span className="absolute inset-[14px] flex items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-md)]">
          <Image src="/brand/fs-mark.png" alt="" width={50} height={28} priority className="h-6 w-auto dark:hidden" />
          <Image src="/brand/fs-mark-reversed.png" alt="" width={50} height={28} priority className="hidden h-6 w-auto dark:block" />
        </span>
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <p data-logotype className="font-display text-[15px] font-semibold tracking-[0.08em] text-navy dark:text-white">FLACRON<span className="text-orange">SPORT</span></p>
        <span aria-hidden className="fs-boot-bar relative h-1 w-40 overflow-hidden rounded-full bg-surface-muted" />
        <p className="text-[13px] text-ink-2">{status}</p>
      </div>
    </div>
  )
}

/** Keeps something mounted briefly after `active` ends so it can animate out. */
export function useExit(active: boolean, ms: number): boolean {
  const [mounted, setMounted] = useState(active)
  useEffect(() => {
    if (active) return setMounted(true)
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [active, ms])
  return mounted
}

function NavProgressInner() {
  const path = usePathname()
  const params = useSearchParams()
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const first = useRef(true)
  const key = `${path}?${params?.toString()}`

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement | null)?.closest?.("a")
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      const raw = anchor.getAttribute("href")
      if (!raw || raw.startsWith("#") || /^(mailto|tel|otpauth):/.test(raw)) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setState("loading")
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setState("done")
    const timer = setTimeout(() => setState("idle"), 520)
    return () => clearTimeout(timer)
  }, [key])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[95] h-[2.5px]">
      <div data-state={state} className="fs-navbar h-full" />
    </div>
  )
}

export function NavProgress() {
  return <Suspense fallback={null}><NavProgressInner /></Suspense>
}

/** The route-level skeleton: the shell stays mounted and only the page area shimmers. */
export function PageLoading({ variant = "cards", width = "lg" }: { variant?: "cards" | "dashboard" | "list" | "detail" | "form"; width?: "lg" | "md" | "sm" }) {
  const { t } = useLocale()
  return (
    <AppPage width={width}>
      <div role="status" aria-label={t.ui.loading} className="space-y-6">
        {variant !== "detail" && (
          <div className="flex items-start gap-4">
            <Skeleton className="hidden size-11 rounded-xl sm:block" />
            <div className="flex-1 space-y-2.5"><Skeleton className="h-7 w-56 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>
          </div>
        )}
        {variant === "dashboard" && <StatRowSkeleton />}
        {(variant === "cards" || variant === "dashboard") && <CardGridSkeleton />}
        {variant === "list" && <ListSkeleton />}
        {variant === "detail" && <DetailSkeleton />}
        {variant === "form" && <><Skeleton className="h-44 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></>}
        <span className="sr-only">{t.ui.loading}</span>
      </div>
    </AppPage>
  )
}
