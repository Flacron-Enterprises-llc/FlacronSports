"use client"

import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

export function BlockedPeople({ onChange }: { onChange(): void }) {
  const { t } = useLocale()
  const [people, setPeople] = useState<{ ref: string; displayName: string }[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    const response = await authFetch("/api/community/block").catch(() => null)
    setPeople(response?.ok ? (await response.json()).blocked : [])
  }

  const unblock = async (ref: string) => {
    const response = await authFetch("/api/community/block", { method: "DELETE", body: JSON.stringify({ ref }) }).catch(() => null)
    setNotice(response?.ok ? t.community.unblocked : t.community.sendFailed)
    if (response?.ok) {
      await load()
      onChange()
    }
  }

  return (
    <details className="mt-3 text-sm" onToggle={(event) => event.currentTarget.open && load()}>
      <summary className="fs-summary inline-flex min-h-10 cursor-pointer items-center gap-1 font-semibold text-ink-2 hover:text-ink sm:min-h-8"><ChevronRight aria-hidden className="fs-chevron size-4" />{t.community.blockedPeople}</summary>
      {people?.length === 0 && <p className="mt-2 text-ink-2">{t.community.noBlocked}</p>}
      <ul className="mt-2 space-y-1">
        {people?.map((person) => (
          <li key={person.ref} className="flex min-h-10 items-center justify-between gap-2 text-ink">
            {person.displayName}
            <button type="button" className="min-h-10 text-xs font-semibold text-ink-2 hover:text-ink sm:min-h-6" onClick={() => unblock(person.ref)}>{t.community.unblock}</button>
          </li>
        ))}
      </ul>
      {notice && <p role="status" className="mt-2 text-ink">{notice}</p>}
    </details>
  )
}
