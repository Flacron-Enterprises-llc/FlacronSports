"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePreferences } from "@/components/account/prefs-provider"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/use-locale"

const CHIP = "inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors"

/** The followed teams live in the browser's preferences, so this part of the page is client-side. */
export function NewsFilters({ q, team, competition, competitions }: { q: string; team: string; competition: string; competitions: string[] }) {
  const { t, href } = useLocale()
  const router = useRouter()
  const { prefs } = usePreferences()
  const link = (next: { team?: string; competition?: string }) => {
    const params = new URLSearchParams({ ...(q ? { q } : {}), ...(next.team ? { team: next.team } : {}), ...(next.competition ? { competition: next.competition } : {}) })
    const query = params.toString()
    return href(`/app/news${query ? `?${query}` : ""}`)
  }
  const options = competition && !competitions.includes(competition) ? [competition, ...competitions] : competitions

  return (
    <div className="mt-3 space-y-3">
      {prefs.favorites.length > 0 && (
        <nav aria-label={t.reports.following} className="flex flex-wrap gap-2">
          <Link href={link({ competition })} aria-current={team ? undefined : "true"} className={cn(CHIP, team ? "border-line text-ink-2 hover:text-ink" : "fs-chip-hot border-transparent")}>{t.reports.allNews}</Link>
          {prefs.favorites.map((name) => (
            <Link key={name} href={link({ team: name, competition })} aria-current={team === name ? "true" : undefined} className={cn(CHIP, team === name ? "fs-chip-hot border-transparent" : "border-line text-ink-2 hover:text-ink")}>{name}</Link>
          ))}
        </nav>
      )}
      {options.length > 0 && (
        <label className="block max-w-xl text-sm font-medium text-ink">
          {t.reports.competition}
          <select className="fs-input mt-1 h-10 px-3 text-sm" value={competition} onChange={(e) => router.push(link({ team, competition: e.target.value }))}>
            <option value="">{t.reports.allCompetitions}</option>
            {options.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
