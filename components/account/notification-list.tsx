"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bell, Flag, PlayCircle } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { lastSeen, markSeen, type NotificationItem } from "@/components/dashboard/notification-bell"
import { EmptyState, ListSkeleton } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

export function NotificationList() {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [seenBefore, setSeenBefore] = useState("")

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/me/notifications").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setSeenBefore(lastSeen())
    setItems(((await response.json()) as { notifications: NotificationItem[] }).notifications)
    markSeen()
  }, [])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  if (failed) return <ErrorNotice onRetry={load}>{t.notifications.unavailable}</ErrorNotice>
  if (!items) return <div role="status" aria-label={t.notifications.loading}><ListSkeleton /></div>
  if (items.length === 0) return <EmptyState icon={<Bell aria-hidden />} title={t.notifications.empty} body={t.notifications.emptyBody} action={{ href: href("/app/scores"), label: t.notifications.browse }} />

  return (
    <ul className="fs-settle space-y-2">
      {items.map((item) => {
        const fresh = item.createdAt > seenBefore
        const Icon = item.type === "start" ? PlayCircle : Flag
        return (
          <li key={item.id} className={cn("flex gap-3 rounded-xl border bg-surface p-3.5 shadow-[var(--shadow-sm)]", fresh ? "border-orange" : "border-line")}>
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand"><Icon aria-hidden className="size-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-sm font-semibold leading-5 text-ink">
                {item.title}
                {fresh && <span className="sr-only"> ({t.ui.unread})</span>}
              </h2>
              <p className="mt-0.5 text-sm leading-6 text-ink-2">{item.body}</p>
              <div className="mt-1 flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                <LocalTime iso={item.createdAt} mode="datetime" />
                {item.path.startsWith("/app/match/") && <Link href={href(item.path)} className="inline-flex items-center gap-1 font-semibold text-hot-text hover:underline">{t.notifications.open}<ArrowRight aria-hidden className="size-3.5" /></Link>}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
