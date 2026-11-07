"use client"

import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

export function RuleList({ wide }: { wide?: boolean }) {
  const { t } = useLocale()
  return (
    <dl className={cn("text-[13px] leading-5", wide ? "grid gap-x-6 gap-y-3.5 sm:grid-cols-2 xl:grid-cols-4" : "space-y-2.5")}>
      {t.community.predictionRuleList.map(([title, body]) => (
        <div key={title} className="min-w-0">
          <dt className="font-semibold text-ink">{title}</dt>
          <dd className="mt-0.5 text-ink-2">{body}</dd>
        </div>
      ))}
    </dl>
  )
}
