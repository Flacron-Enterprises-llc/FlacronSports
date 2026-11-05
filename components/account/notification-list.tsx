"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { EmptyState } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

interface Item {
  id: string
  title: string
  body: string
  path: string
  createdAt: string
}

export function NotificationList() {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [items, setItems] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    setFailed(false)
    ;(async () => {
      const response = await authFetch("/api/me/notifications").catch(() => null)
      if (!active) return
      if (!response?.ok) return setFailed(true)
      setItems(((await response.json()) as { notifications: Item[] }).notifications)
    })()
    return () => {
      active = false
    }
  }, [user])

  if (!user) return <p className="text-sm text-ink-2">{t.notifications.signedOut} <Link className="font-semibold text-hot-text underline" href={href("/signin")}>{t.nav.signIn}</Link></p>
  if (failed) return <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-bad">{t.notifications.unavailable}</p>
  if (!items) return <p role="status" className="text-sm text-ink-2">{t.notifications.loading}</p>
  if (items.length === 0) return <EmptyState title={t.notifications.empty} body={t.notifications.emptyBody} action={{ href: href("/scores"), label: t.notifications.browse }} />

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold text-ink">{item.title}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-2">{item.body}</p>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-3">
            <LocalTime iso={item.createdAt} mode="datetime" />
            <Link href={href(item.path)} className="font-semibold text-hot-text hover:underline">{t.notifications.open}</Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
