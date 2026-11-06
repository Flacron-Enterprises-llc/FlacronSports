"use client"

import { useRouter } from "next/navigation"
import { useLocale } from "@/lib/use-locale"

/** Goes straight to the chosen date. `template` holds the current filters with {date} in place of the date. */
export function DateJump({ value, template }: { value: string; template: string }) {
  const { t } = useLocale()
  const router = useRouter()
  return (
    <label className="block text-[13px] font-medium text-ink-2">
      <span className="sr-only">{t.scores.date}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => { if (event.target.value) router.push(template.replace("{date}", event.target.value)) }}
        className="fs-input h-10 px-3 text-sm sm:w-40"
      />
    </label>
  )
}
