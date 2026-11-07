"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { useAccount } from "@/components/dashboard/account-context"
import { ShareLink, ErrorNotice, useConfirm } from "@/components/dashboard/controls"
import { btn, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

export function CalendarFeedPanel() {
  const { t } = useLocale()
  const copy = t.discover
  const { plan, loaded } = useAccount()
  const { confirm, dialog } = useConfirm()
  const [active, setActive] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const allowed = loaded && plan !== "none"

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/me/calendar-feed").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setActive(((await response.json()) as { active: boolean }).active)
  }, [])

  useEffect(() => {
    if (allowed) void load()
  }, [allowed, load])

  // Settings is open to accounts with no plan, and this feature needs one.
  if (!allowed) return null

  const generate = async () => {
    if (active && !(await confirm(copy.feedReplaceConfirm, true))) return
    setBusy(true)
    const response = await authFetch("/api/me/calendar-feed", { method: "POST" }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return void toast(copy.feedFailed)
    setUrl(((await response.json()) as { url: string }).url)
    setActive(true)
  }

  const turnOff = async () => {
    if (!(await confirm(copy.feedOffConfirm, true))) return
    const response = await authFetch("/api/me/calendar-feed", { method: "DELETE" }).catch(() => null)
    if (!response?.ok) return void toast(copy.feedFailed)
    setUrl(null)
    setActive(false)
  }

  return (
    <Panel id="calendar" title={copy.feedTitle} description={copy.feedLead} icon={<CalendarPlus aria-hidden />}>
      {dialog}
      {failed && <ErrorNotice onRetry={load}>{copy.feedFailed}</ErrorNotice>}
      {!failed && active === null && <div role="status" aria-label={t.ui.loading}><Skeleton className="h-9 w-48" /></div>}
      {url && (
        <div className="mb-4 space-y-2">
          <ShareLink value={url} label={copy.feedTitle} copy={copy.feedCopy} copied={copy.feedCopied} note={`${copy.feedSecret} ${copy.feedOnce}`} />
          <a href={url.replace(/^https?:/, "webcal:")} className={btn("outline", "sm")}>{copy.feedOpen}</a>
        </div>
      )}
      {active !== null && (
        <>
          {active && !url && <p className="mb-3 text-sm text-ink-2">{copy.feedActive} {copy.feedOnce}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={generate} className={btn(active ? "outline" : "navy")}>{active ? copy.feedReplace : copy.feedCreate}</button>
            {active && <button type="button" onClick={turnOff} className={btn("ghost")}>{copy.feedOff}</button>}
          </div>
        </>
      )}
    </Panel>
  )
}
