import type { Preferences } from "@/lib/me/preferences-defaults"
import { isFollowed, type Following } from "@/lib/sports/following"
import type { SportEvent } from "@/lib/sports/types"
import { upcomingEvents } from "@/lib/sports/upcoming"

export const AGENDA_DAYS = 7
// The job keeps seven days ahead in rotation, so a feed reaches as far as there is data.
export const FEED_DAYS = 8

export const relevantToMember = (prefs: Following & Pick<Preferences, "reminders">, event: SportEvent): boolean =>
  isFollowed(prefs, event) || prefs.reminders.some((item) => item.eventId === event.id)

/** A member's own games over the coming days, in start order. */
export async function memberEvents(prefs: Preferences, days: number = AGENDA_DAYS, now: Date = new Date()): Promise<SportEvent[]> {
  return (await upcomingEvents(days, now))
    .filter((event) => relevantToMember(prefs, event))
    .sort((a, b) => (a.scheduledStartUTC ?? "").localeCompare(b.scheduledStartUTC ?? ""))
}
