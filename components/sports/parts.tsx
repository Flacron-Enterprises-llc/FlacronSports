"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { Eye, Star } from "lucide-react"
import { toast } from "sonner"
import { usePreferences } from "@/components/account/prefs-provider"
import { AutoRefresh } from "@/components/dashboard/controls"
import { Skeleton } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

/** UTC is stored; the visitor's own time zone is only applied in the browser. */
export function LocalTime({ iso, mode = "time" }: { iso: string; mode?: "time" | "datetime" | "date" }) {
  const { locale } = useLocale()
  const { prefs, signedIn } = usePreferences()
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions =
      mode === "time" ? { hour: "2-digit", minute: "2-digit" } : mode === "date" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }
    if (signedIn && prefs.timeZone !== "UTC") options.timeZone = prefs.timeZone
    setText(new Intl.DateTimeFormat(locale, options).format(new Date(iso)))
  }, [iso, locale, mode, prefs.timeZone, signedIn])

  return <time dateTime={iso} className="tabular">{text ?? iso.slice(11, 16) + " UTC"}</time>
}

export function useFavorites() {
  const { prefs, toggleFavorite } = usePreferences()
  return { names: prefs.favorites, toggle: toggleFavorite }
}

/** Athletes and entrants have no crest, and low-data mode never loads one. `band` is for the navy hero. */
export function Crest({ name, url, size = "sm", band }: { name: string; url?: string | null; size?: "xs" | "sm" | "lg"; band?: boolean }) {
  const { prefs } = usePreferences()
  const box = size === "lg" ? "size-14 text-base sm:size-[4.5rem] sm:text-lg" : size === "xs" ? "size-5 text-[8px]" : "size-6 text-[9px] sm:size-7 sm:text-[10px]"
  const [broken, setBroken] = useState(false)
  if (url && !prefs.lowData && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className={cn("shrink-0 object-contain", box)} />
  }
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
  return <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold", band ? "bg-white/10 text-white" : "bg-surface-muted text-ink-2", box)}>{letters}</span>
}

export function FavoriteStar({ team }: { team: string }) {
  const { t } = useLocale()
  const { names, toggle } = useFavorites()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  if (!team || team === "TBD") return null
  const on = optimistic ?? names.includes(team)

  const press = async () => {
    setOptimistic(!on)
    const result = await toggle(team)
    setOptimistic(null)
    if (result === "limit") toast(t.myTeams.limit)
    if (result === "failed") toast(t.ui.saveFailed)
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? t.myTeams.unfollow : t.myTeams.follow}: ${team}`}
      onClick={press}
      className="-mx-1.5 -my-1 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:text-ink sm:mx-0 sm:my-0 sm:size-7 sm:hover:bg-surface-muted"
    >
      <Star aria-hidden className={cn("size-3.5", on && "fs-star-on fill-orange text-orange")} />
    </button>
  )
}

const ScopeContext = createContext<{ revealed: boolean; reveal(): void } | null>(null)

/** One reveal for everything inside, so a card never shows half a result. */
export function SpoilerScope({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  const value = useMemo(() => ({ revealed, reveal: () => setRevealed(true) }), [revealed])
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

/**
 * Masks results in the rendered DOM rather than with CSS, so they also stay out
 * of the accessibility tree. Until saved preferences load nothing is shown, so a
 * spoiler-mode user never sees a flash of the score. Each reveal lasts for that view only.
 */
function useSpoiler() {
  const { prefs, ready } = usePreferences()
  const scope = useContext(ScopeContext)
  const [own, setOwn] = useState(false)
  const pending = ready === false
  return {
    hidden: (prefs.spoilerMode || pending) && !(scope ? scope.revealed : own),
    pending,
    scoped: scope !== null,
    reveal: scope ? scope.reveal : () => setOwn(true),
  }
}

export function ScoreValue({ value, label, dim }: { value: number | string | undefined; label: string; dim?: boolean }) {
  const { t } = useLocale()
  const { hidden, pending, scoped, reveal } = useSpoiler()

  if (value === undefined) return null
  if (pending) return <Skeleton className="h-5 w-6 shrink-0" />
  if (hidden && scoped) return <span aria-hidden className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-3">•</span>
  if (hidden) {
    return (
      <button type="button" onClick={reveal} aria-label={`${t.spoiler.reveal}: ${label}`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-3 hover:text-ink sm:size-7">
        <Eye aria-hidden className="size-4" />
      </button>
    )
  }
  return <span className={cn("tabular shrink-0 text-right font-display text-base font-semibold", dim ? "text-ink-3" : "text-ink")}>{value}</span>
}

/** The single reveal control of a SpoilerScope. Renders nothing once revealed. */
export function SpoilerReveal({ label }: { label: string }) {
  const { hidden, pending, reveal } = useSpoiler()
  if (!hidden || pending) return null
  return (
    <button type="button" onClick={reveal} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 text-[13px] font-semibold text-ink-2 hover:text-ink sm:min-h-8">
      <Eye aria-hidden className="size-3.5" /> {label}
    </button>
  )
}

/** A short detail that hints at the result. It simply stays away until the result is shown. */
export function SpoilerText({ children }: { children: React.ReactNode }) {
  const { hidden, pending } = useSpoiler()
  return hidden || pending ? null : <>{children}</>
}

/** For anything that states a result. `quiet` leaves the control to a SpoilerReveal nearby. */
export function SpoilerGuard({ label, children, quiet }: { label: string; children: React.ReactNode; quiet?: boolean }) {
  const { hidden, pending, reveal } = useSpoiler()
  if (pending) return <Skeleton className="h-5 w-40" />
  if (hidden) {
    if (quiet) return null
    return (
      <button type="button" onClick={reveal} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-surface-muted px-3 text-sm font-semibold text-ink-2 hover:text-ink sm:min-h-9">
        <Eye aria-hidden className="size-4" /> {label}
      </button>
    )
  }
  return <>{children}</>
}

export function MatchScore({ home, away, label }: { home: number; away: number; label: string }) {
  const { t } = useLocale()
  const { hidden, pending, reveal } = useSpoiler()

  if (pending) return <Skeleton className="mx-auto h-12 w-28 opacity-30" />
  if (hidden) {
    return (
      <button type="button" onClick={reveal} aria-label={`${t.spoiler.reveal}: ${label}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 text-sm font-semibold text-white hover:bg-white/15">
        <Eye aria-hidden className="size-4" /> {t.spoiler.reveal}
      </button>
    )
  }
  const long = Math.max(String(home).length, String(away).length) > 2
  return (
    <span className={cn("fs-score inline-flex items-baseline gap-2 whitespace-nowrap font-bold text-white sm:gap-3.5", long ? "text-[2.125rem] sm:text-6xl" : "text-[2.625rem] sm:text-7xl")}>
      <span>{home}</span><span aria-hidden className="font-medium text-white/40">–</span><span className="sr-only"> – </span><span>{away}</span>
    </span>
  )
}

/** Refreshes the page while something is live. Low-data mode loads only on request. */
export function LiveRefresh({ live }: { live: boolean }) {
  const { prefs } = usePreferences()
  return <AutoRefresh enabled={live && !prefs.lowData} />
}
