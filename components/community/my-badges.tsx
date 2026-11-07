"use client"

import { useCallback, useEffect, useState } from "react"
import { Award } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import { BADGES } from "@/lib/community/badge-names"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

export function MyBadges() {
  const { t } = useLocale()
  const [badges, setBadges] = useState<Badge[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/community/badges").catch(() => null)
    if (response?.ok) setBadges((await response.json()).badges)
    else setFailed(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Panel title={t.community.badgesTitle} description={t.community.badgesLead} icon={<Award aria-hidden />}>
      {failed && <ErrorNotice onRetry={load}>{t.community.loadFailed}</ErrorNotice>}
      {!badges && !failed && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
      {badges && (
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {BADGES.map((badge) => {
            const earned = badges.includes(badge)
            return (
              <li key={badge} className={cn("flex min-w-0 items-start gap-2.5 rounded-lg border p-2.5", earned ? "border-line-strong" : "border-line")}>
                <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", earned ? "fs-chip-hot" : "bg-surface-muted text-ink-3")}><Award aria-hidden className="size-4" /></span>
                <span className="min-w-0">
                  <span className={earned ? "block font-semibold text-ink" : "block font-medium text-ink-2"}>{t.community.badgeNames[badge]}</span>
                  <span className="block text-xs leading-5 text-ink-2">{t.community.badgeHelp[badge]}</span>
                  {earned && <span className="block text-xs font-semibold text-hot-text">{t.community.badgeEarned}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
