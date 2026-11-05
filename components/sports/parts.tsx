"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { PLANS } from "@/lib/billing/plans"
import { useLocale } from "@/lib/use-locale"

/** UTC is stored; the visitor's own time zone is only applied in the browser. */
export function LocalTime({ iso, mode = "time" }: { iso: string; mode?: "time" | "datetime" }) {
  const { locale } = useLocale()
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions =
      mode === "time" ? { hour: "2-digit", minute: "2-digit" } : { dateStyle: "medium", timeStyle: "short" }
    setText(new Intl.DateTimeFormat(locale, options).format(new Date(iso)))
  }, [iso, locale, mode])

  return <time dateTime={iso} className="tabular">{text ?? iso.slice(11, 16) + " UTC"}</time>
}

const KEY = "fs-favorites"
const EVENT = "fs-favorites-changed"

export function readFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
  } catch {
    return []
  }
}

function writeFavorites(names: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(names))
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useFavorites() {
  const [names, setNames] = useState<string[]>([])

  useEffect(() => {
    const sync = () => setNames(readFavorites())
    sync()
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])

  return {
    names,
    atLimit: names.length >= (PLANS.free.favoritesLimit as number),
    toggle(name: string): boolean {
      const current = readFavorites()
      if (current.includes(name)) {
        writeFavorites(current.filter((item) => item !== name))
        return true
      }
      if (current.length >= (PLANS.free.favoritesLimit as number)) return false
      writeFavorites([...current, name])
      return true
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
        onClick={() => setBlocked(!toggle(team))}
        className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"
      >
        <Star aria-hidden className={`size-4 ${on ? "fill-orange text-orange" : ""}`} />
      </button>
    </span>
  )
}
