"use client"

import { useCallback, useEffect, useState } from "react"
import { Award } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import { BADGES } from "@/lib/community/badge-names"
import { useLocale } from "@/lib/use-locale"

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
        <ul className="divide-y divide-line text-sm">
          {BADGES.map((badge) => (
            <li key={badge} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <span className={badges.includes(badge) ? "font-semibold text-ink" : "font-medium text-ink-2"}>{t.community.badgeNames[badge]}</span>
                <span className="block text-[13px] leading-5 text-ink-2">{t.community.badgeHelp[badge]}</span>
              </span>
              {badges.includes(badge) && <span className="shrink-0 text-xs font-semibold text-ink">{t.community.badgeEarned}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
