// Days as the member lives them. The feed files games by UTC date, so a member east of
// UTC finds a late kickoff a day early and one west of it a day late. A local day is
// built from the UTC dates it overlaps, keeping only games that start on it there.

import type { SportEvent } from "@/lib/sports/types"

export const TIME_ZONE_COOKIE = "fs_tz"

export function validZone(zone: string | null | undefined): string {
  if (!zone) return "UTC"
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone })
    return zone
  } catch {
    return "UTC"
  }
}

const dayFormat = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })

export function localDate(at: Date, zone: string): string {
  return dayFormat(zone).format(at)
}

const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/** The UTC dates a local day overlaps: its own, and the one before or after. */
export function utcDatesFor(date: string, zone: string): string[] {
  const start = localDate(new Date(`${date}T00:00:00Z`), zone)
  const end = localDate(new Date(`${date}T23:59:59Z`), zone)
  // A zone east of UTC is already on this date before UTC is, so the evening before counts.
  if (start === date && end > date) return [shift(date, -1), date]
  if (end === date && start < date) return [date, shift(date, 1)]
  return [date]
}

/** A game with a time belongs to the day it starts on locally. A date-only game keeps its date. */
export function onLocalDay(event: Pick<SportEvent, "scheduledStartUTC" | "dateOnly" | "details">, date: string, zone: string, filedUnder: string): boolean {
  // A Test on its third day keeps its first day's start, so it belongs to the day it was filed under.
  if (!event.scheduledStartUTC || event.dateOnly || (event.details?.kind === "cricket" && event.details.matchDay)) return filedUnder === date
  return localDate(new Date(event.scheduledStartUTC), zone) === date
}
