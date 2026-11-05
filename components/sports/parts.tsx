"use client"

import { useEffect, useState } from "react"
import { Eye, Star } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { PLANS } from "@/lib/billing/plans"
import { useLocale } from "@/lib/use-locale"

/** UTC is stored; the visitor's own time zone is only applied in the browser. */
export function LocalTime({ iso, mode = "time" }: { iso: string; mode?: "time" | "datetime" }) {
  const { locale } = useLocale()
  const { prefs, signedIn } = usePreferences()
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions =
      mode === "time" ? { hour: "2-digit", minute: "2-digit" } : { dateStyle: "medium", timeStyle: "short" }
    if (signedIn && prefs.timeZone !== "UTC") options.timeZone = prefs.timeZone
    setText(new Intl.DateTimeFormat(locale, options).format(new Date(iso)))
  }, [iso, locale, mode, prefs.timeZone, signedIn])

  return <time dateTime={iso} className="tabular">{text ?? iso.slice(11, 16) + " UTC"}</time>
}

export function useFavorites() {
  const { prefs, signedIn, update } = usePreferences()
  const names = prefs.favorites
  return {
    names,
    async toggle(name: string): Promise<boolean> {
      if (names.includes(name)) return update({ favorites: names.filter((item) => item !== name) })
      // Guests are always on the Free allowance. Signed-in limits are enforced by the server.
      if (!signedIn && names.length >= (PLANS.free.favoritesLimit as number)) return false
      return update({ favorites: [...names, name] })
    },
  }
}

export function FavoriteStar({ team }: { team: string }) {
  const { t } = useLocale()
  const { names, toggle } = useFavorites()
  const [blocked, setBlocked] = useState(false)
  const on = names.includes(team)

  return (
    <span className="inline-flex items-center gap-2">
      {blocked && <span role="status" className="text-xs text-warn">{t.myTeams.limit}</span>}
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${on ? t.myTeams.unfollow : t.myTeams.follow}: ${team}`}
        onClick={async () => setBlocked(!(await toggle(team)))}
        className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"
      >
        <Star aria-hidden className={`size-4 ${on ? "fill-orange text-orange" : ""}`} />
      </button>
    </span>
  )
}

/**
 * Spoiler mode masks the value in the rendered DOM rather than with CSS, so it
 * also stays out of the accessibility tree. Each reveal lasts for that view only.
 */
export function ScoreValue({ value, label }: { value: number | undefined; label: string }) {
  const { prefs } = usePreferences()
  const { t } = useLocale()
  const [revealed, setRevealed] = useState(false)

  if (value === undefined) return null
  if (prefs.spoilerMode && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        aria-label={`${t.spoiler.reveal}: ${label}`}
        className="inline-flex size-7 items-center justify-center rounded-md bg-surface-muted text-ink-3 hover:text-ink"
      >
        <Eye aria-hidden className="size-4" />
      </button>
    )
  }
  return <span className="tabular font-display text-lg font-semibold text-ink">{value}</span>
}

/** For generated text that states a result. Same reveal rule as the score itself. */
export function SpoilerGuard({ label, children }: { label: string; children: React.ReactNode }) {
  const { prefs } = usePreferences()
  const [revealed, setRevealed] = useState(false)

  if (prefs.spoilerMode && !revealed) {
    return (
      <button type="button" onClick={() => setRevealed(true)} className="rounded-md bg-surface-muted px-3 py-2 text-sm font-semibold text-ink-2 hover:text-ink">
        {label}
      </button>
    )
  }
  return <>{children}</>
}

export function MatchScore({ home, away, label }: { home: number; away: number; label: string }) {
  const { prefs } = usePreferences()
  const { t } = useLocale()
  const [revealed, setRevealed] = useState(false)

  if (prefs.spoilerMode && !revealed) {
    return (
      <button type="button" onClick={() => setRevealed(true)} aria-label={`${t.spoiler.reveal}: ${label}`} className="rounded-md bg-surface-muted px-3 py-2 text-sm font-semibold text-ink-2 hover:text-ink">
        {t.spoiler.reveal}
      </button>
    )
  }
  return <span className="tabular font-display text-3xl font-bold text-ink">{home} - {away}</span>
}
