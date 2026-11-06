"use client"

import { useLocale } from "@/lib/use-locale"

export function RuleList() {
  const { t } = useLocale()
  return (
    <dl className="space-y-2.5 text-sm leading-6">
      {t.community.predictionRuleList.map(([title, body]) => (
        <div key={title}>
          <dt className="font-semibold text-ink">{title}</dt>
          <dd className="text-ink-2">{body}</dd>
        </div>
      ))}
    </dl>
  )
}
