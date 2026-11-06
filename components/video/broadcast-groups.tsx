"use client"

import { useEffect, useMemo, useState } from "react"
import { Tv } from "lucide-react"
import type { Broadcast } from "@/lib/sports/service"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

const FIRST_GROUPS = 6

export interface BroadcastGroup {
  country: string | null
  channels: Broadcast[]
}

/** The viewer's country leads, the rest follow by name, and listings with no country come last. */
export function groupBroadcasts(broadcasts: Broadcast[], viewerCountry: string | null): BroadcastGroup[] {
  const groups = new Map<string | null, Broadcast[]>()
  const seen = new Set<string>()
  for (const item of broadcasts) {
    const key = `${item.country}:${item.channel}`
    if (seen.has(key)) continue
    seen.add(key)
    groups.set(item.country, [...(groups.get(item.country) ?? []), item])
  }
  const rank = (country: string | null) => (country === null ? 2 : country === viewerCountry ? 0 : 1)
  return [...groups.entries()]
    .map(([country, channels]) => ({ country, channels: [...channels].sort((a, b) => a.channel.localeCompare(b.channel)) }))
    .sort((a, b) => rank(a.country) - rank(b.country) || (a.country ?? "").localeCompare(b.country ?? ""))
}

function regionName(code: string | null | undefined): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null
  } catch {
    return null
  }
}

/** Listings name countries in English, so the viewer's country is matched in English too. */
function browserCountry(): string | null {
  try {
    return regionName(new Intl.Locale(navigator.language).region)
  } catch {
    return null
  }
}

export function BroadcastGroups({ broadcasts, viewerCountryCode }: { broadcasts: Broadcast[]; viewerCountryCode?: string | null }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [guess, setGuess] = useState<string | null>(null)
  useEffect(() => setGuess(browserCountry()), [])

  const viewer = regionName(viewerCountryCode) ?? guess
  const groups = useMemo(() => groupBroadcasts(broadcasts, viewer), [broadcasts, viewer])
  const shown = expanded ? groups : groups.slice(0, FIRST_GROUPS)
  const countries = groups.filter((group) => group.country).length

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t.match.tvListings}</h3>
        <p className="text-xs text-ink-3">{t.match.listingsCount.replace("{channels}", String(groups.reduce((total, group) => total + group.channels.length, 0))).replace("{countries}", String(countries))}</p>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((group) => {
          const mine = group.country !== null && group.country === viewer
          return (
            <li key={group.country ?? "other"} className={cn("min-w-0 rounded-lg border bg-surface p-3", mine ? "border-brand" : "border-line")}>
              <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-ink">
                <span className="min-w-0 truncate">{group.country ?? t.match.otherCountries}</span>
                {mine && <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-2">{t.match.yourCountry}</span>}
              </p>
              <ul className="mt-2 space-y-1.5">
                {group.channels.map((item) => (
                  <li key={item.id} className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
                    <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {item.logoUrl ? <img src={item.logoUrl} alt="" loading="lazy" decoding="async" className="size-full object-contain p-0.5" /> : <Tv aria-hidden className="size-3 text-ink-3" />}
                    </span>
                    <span className="min-w-0 truncate">{item.channel}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      {groups.length > FIRST_GROUPS && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-hot-text underline-offset-2 hover:underline">
          {expanded ? t.match.showFewer : t.match.showAllCountries.replace("{count}", String(groups.length))}
        </button>
      )}
      <p className="mt-3 text-xs leading-5 text-ink-3">{t.match.listingsDisclaimer}</p>
    </div>
  )
}
