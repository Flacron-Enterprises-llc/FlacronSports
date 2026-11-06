"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import { Skeleton } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { readStored, writeStored } from "@/lib/storage-consent"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { usePopover } from "./controls"

export interface NotificationItem {
  id: string
  type: "start" | "final"
  title: string
  body: string
  path: string
  createdAt: string
}

const SEEN_KEY = "fs-notifications-seen"
const SEEN_EVENT = "fs-notifications-seen"
const POLL_MS = 60_000

export const lastSeen = () => readStored<string>(SEEN_KEY, "")

/** The feed has no read state of its own, so "unread" means newer than the last time this browser looked. */
export function markSeen() {
  writeStored(SEEN_KEY, new Date().toISOString())
  window.dispatchEvent(new Event(SEEN_EVENT))
}

export function NotificationBell() {
  const { t, href } = useLocale()
  const { open, setOpen, box, trigger } = usePopover()
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [seen, setSeen] = useState("")

  const load = useCallback(async () => {
    const response = await authFetch("/api/me/notifications").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setFailed(false)
    setItems(((await response.json()) as { notifications: NotificationItem[] }).notifications)
  }, [])

  useEffect(() => {
    const sync = () => setSeen(lastSeen())
    sync()
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void load()
    }, POLL_MS)
    window.addEventListener(SEEN_EVENT, sync)
    return () => {
      clearInterval(timer)
      window.removeEventListener(SEEN_EVENT, sync)
    }
  }, [load])

  const unread = (items ?? []).filter((item) => item.createdAt > seen).length
  const label = unread > 0 ? t.ui.unreadLabel.replace("{count}", String(unread)) : t.dash.notifications

  return (
    <div ref={box} data-tour="notifications" className="relative">
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={t.dash.notifications} onClick={() => setOpen(!open)} className="relative inline-flex size-10 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink">
        <Bell aria-hidden className={cn("size-[18px]", unread > 0 && "text-ink")} />
        {unread > 0 && <span aria-hidden className="fs-pop absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-orange px-1 text-[10.5px] font-bold leading-[18px] text-hot-on ring-2 ring-surface">{unread > 99 ? "99+" : unread}</span>}
      </button>
      <span className="sr-only" aria-live="polite">{unread > 0 ? label : ""}</span>
      {open && (
        <div role="dialog" aria-label={t.ui.latestNotifications} className="fs-pop fixed inset-x-3 top-[4.25rem] z-40 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-[var(--shadow-lg)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {t.dash.notifications}
              {unread > 0 && <span className="fs-chip-hot tabular ml-2 rounded-full border px-1.5 py-px text-[11px]">{t.ui.newCount.replace("{count}", String(unread))}</span>}
            </p>
            <button type="button" onClick={markSeen} disabled={unread === 0} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50">
              <CheckCheck aria-hidden className="size-3.5" /> {t.ui.markAllRead}
            </button>
          </div>
          <div className="fs-noscrollbar max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
            {items === null && !failed && (
              <div role="status" aria-label={t.notifications.loading} className="space-y-3 p-2">
                {[0, 1, 2].map((item) => <div key={item} className="space-y-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}
              </div>
            )}
            {failed && !items && <p role="alert" className="px-4 py-8 text-center text-sm text-ink-2">{t.notifications.unavailable}</p>}
            {items?.length === 0 && (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-brand"><Inbox aria-hidden className="size-5" /></span>
                <p className="mt-3 text-sm font-semibold text-ink">{t.ui.allCaughtUp}</p>
                <p className="mt-1 text-[13px] leading-5 text-ink-2">{t.notifications.emptyBody}</p>
              </div>
            )}
            <ul>
              {items?.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link href={href(item.path)} onClick={() => setOpen(false)} className="flex gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-muted">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.createdAt > seen ? "bg-orange" : "bg-transparent")} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-ink-2">{item.body}</span>
                      <span className="mt-0.5 block text-xs text-ink-3"><LocalTime iso={item.createdAt} mode="datetime" /></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <Link href={href("/app/settings#alerts")} onClick={() => setOpen(false)} className="text-[13px] font-medium text-ink-2 hover:text-ink">{t.ui.preferences}</Link>
            <Link href={href("/app/notifications")} onClick={() => setOpen(false)} className="text-[13px] font-semibold text-hot-text hover:underline">{t.dash.viewAll}</Link>
          </div>
        </div>
      )}
    </div>
  )
}
