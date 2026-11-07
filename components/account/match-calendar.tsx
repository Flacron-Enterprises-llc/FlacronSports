"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { ErrorNotice } from "@/components/dashboard/controls"
import { ListSkeleton, Panel } from "@/components/site/states"
import { StatusLabel } from "@/components/sports/event-card"
import { ReminderBell } from "@/components/sports/event-actions"
import { LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { eventTitle } from "@/lib/sports/presentation"
import type { SportEvent } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"

const safeZone = (zone: string): Intl.DateTimeFormatOptions => (zone === "UTC" ? {} : { timeZone: zone })

export function MatchCalendar() {
  const { locale, t, href } = useLocale()
  const copy = t.discover
  const { prefs } = usePreferences()
  const [events, setEvents] = useState<SportEvent[] | null>(null)
  const [failed, setFailed] = useState(false)
  const following = JSON.stringify([prefs.favorites, prefs.leagues.map((league) => league.id), prefs.players.map((player) => player.id), prefs.reminders.map((item) => item.eventId)])

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/me/calendar").catch(() => null)
    if (!response?.ok) return setFailed(true)
    setEvents(((await response.json()) as { events: SportEvent[] }).events)
  }, [])

  useEffect(() => {
    void load()
  }, [load, following])

  // Grouped in the member's own time zone, so a late game sits under the day they will see it.
  const days = useMemo(() => {
    const groups = new Map<string, SportEvent[]>()
    for (const event of events ?? []) {
      if (!event.scheduledStartUTC || (event.status !== "scheduled" && event.status !== "live" && event.status !== "postponed")) continue
      const label = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", ...safeZone(prefs.timeZone) }).format(new Date(event.scheduledStartUTC))
      groups.set(label, [...(groups.get(label) ?? []), event])
    }
    return [...groups.entries()]
  }, [events, locale, prefs.timeZone])

  return (
    <Panel title={copy.calendarTitle} description={copy.calendarLead} icon={<CalendarDays aria-hidden />}>
      {failed && <ErrorNotice onRetry={load}>{copy.calendarFailed}</ErrorNotice>}
      {!failed && !events && <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={3} /></div>}
      {!failed && events && days.length === 0 && <p className="text-sm text-ink-2">{copy.calendarEmpty}</p>}
      <div className="space-y-4">
        {days.map(([label, list]) => (
          <section key={label} aria-label={label}>
            <h3 className="text-[13px] font-semibold capitalize text-ink">{label}</h3>
            <ul className="mt-1 divide-y divide-line">
              {list.map((event) => (
                <li key={event.id} className="flex min-h-12 min-w-0 items-center gap-3 py-1 text-sm">
                  <span className="w-14 shrink-0 text-xs font-semibold text-ink">{event.dateOnly ? "–" : <LocalTime iso={event.scheduledStartUTC as string} />}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={href(`/app/match/${event.id}`)} className="block truncate font-medium text-ink underline-offset-2 hover:underline">{eventTitle(event)}</Link>
                    <span className="block truncate text-xs text-ink-2">{event.competition.name}</span>
                  </span>
                  {event.status !== "scheduled" && <StatusLabel status={event.status} t={t} />}
                  <ReminderBell event={event} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  )
}
