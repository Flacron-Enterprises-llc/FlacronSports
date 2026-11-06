"use client"

import { Award } from "lucide-react"
import type { Badge } from "@/lib/community/badges"
import { useLocale } from "@/lib/use-locale"

export function BadgeList({ badges }: { badges?: Badge[] }) {
  const { t } = useLocale()
  if (!badges?.length) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {badges.map((badge) => (
        <span key={badge} title={t.community.badgeHelp[badge]} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted px-1.5 py-px text-[11px] font-medium text-ink-2">
          <Award aria-hidden className="size-3" />{t.community.badgeNames[badge]}
        </span>
      ))}
    </span>
  )
}
