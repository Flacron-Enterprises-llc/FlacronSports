"use client"

import Link from "next/link"
import { usePreferences } from "@/components/account/prefs-provider"
import { newsChip } from "@/components/reports/news-card"
import { useLocale } from "@/lib/use-locale"

/** The followed teams live in the browser's preferences, so this part of the page is client-side. */
export function FollowedTeams({ query, team }: { query: Record<string, string>; team: string }) {
  const { t, href } = useLocale()
  const { prefs } = usePreferences()
  if (prefs.favorites.length === 0) return null
  const link = (name?: string) => {
    const params = new URLSearchParams({ ...query, ...(name ? { team: name } : {}) })
    const search = params.toString()
    return href(`/app/news${search ? `?${search}` : ""}`)
  }

  return (
    <nav aria-label={t.reports.following} className="fs-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
      <Link href={link()} aria-current={team ? undefined : "true"} className={newsChip(!team)}>{t.reports.allNews}</Link>
      {prefs.favorites.map((name) => (
        <Link key={name} href={link(name)} aria-current={team === name ? "true" : undefined} className={newsChip(team === name)}>{name}</Link>
      ))}
    </nav>
  )
}
