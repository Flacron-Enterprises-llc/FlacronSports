"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { usePreferences } from "@/components/account/prefs-provider"
import { Switch } from "@/components/dashboard/controls"
import { followFilter, type FollowFilter } from "@/lib/sports/score-filters"
import { useLocale } from "@/lib/use-locale"

/** The choice is saved with the account, and the address carries who to show so paging and links keep it. */
export function FavoritesFilter() {
  const { t } = useLocale()
  const { prefs, ready, update } = usePreferences()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const id = useId()
  // The saved choice takes a moment to come back from the server, and the effect below must not undo a press.
  const [choice, setChoice] = useState<boolean | null>(null)
  const wanted = choice ?? prefs.scoresFavoritesOnly

  const follow = useMemo(() => followFilter(prefs), [prefs])
  const followsSomeone = Boolean(follow.fav || follow.favl)
  const [fav, favl] = [params?.get("fav") ?? "", params?.get("favl") ?? ""]
  const applied = Boolean(fav || favl)

  const go = useCallback((next: FollowFilter | null) => {
    const query = new URLSearchParams(params ?? undefined)
    for (const key of ["fav", "favl", "page"]) query.delete(key)
    if (next?.fav) query.set("fav", next.fav)
    if (next?.favl) query.set("favl", next.favl)
    const text = query.toString()
    router.replace(text ? `${pathname}?${text}` : (pathname ?? "/"), { scroll: false })
  }, [params, pathname, router])

  useEffect(() => {
    if (ready === false || !wanted) return
    if (!followsSomeone) {
      if (applied) go(null)
    } else if (fav !== follow.fav || favl !== follow.favl) go(follow)
  }, [applied, fav, favl, follow, followsSomeone, go, ready, wanted])

  const change = (on: boolean) => {
    setChoice(on)
    go(on ? follow : null)
    void update({ scoresFavoritesOnly: on })
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={applied} onChange={change} labelledBy={id} disabled={!followsSomeone && !applied} />
      <span id={id} className="text-[13px] font-medium text-ink-2">{t.scores.favoritesOnly}</span>
      {!followsSomeone && ready !== false && <span className="text-xs text-ink-3">{t.scores.favoritesNone}</span>}
    </div>
  )
}
