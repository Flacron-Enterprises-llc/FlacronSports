import { createHash } from "node:crypto"
import { eventTitle } from "@/lib/sports/presentation"
import type { SportEvent } from "@/lib/sports/types"

const DOMAIN = "flacronsport.com"

/** Derived from the game alone, so a moved game updates the entry a member already has. */
export const eventUid = (event: Pick<SportEvent, "id">): string => `${createHash("sha256").update(event.id).digest("hex").slice(0, 32)}@${DOMAIN}`

const escapeText = (text: string): string => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

const stamp = (date: Date): string => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

/** RFC 5545 folds at 75 octets, and a fold must not split a character. */
function foldLine(line: string): string {
  const parts: string[] = []
  let current = ""
  let size = 0
  for (const character of line) {
    const bytes = Buffer.byteLength(character)
    if (size + bytes > 75) {
      parts.push(current)
      current = " "
      size = 1
    }
    current += character
    size += bytes
  }
  parts.push(current)
  return parts.join("\r\n")
}

const CANCELLED = new Set<SportEvent["status"]>(["canceled", "abandoned"])

// Built from the schedule fields only. The score and any result never reach this file,
// because a calendar has no spoiler control. An end time is left out: nobody states one.
function vevent(event: SportEvent, siteUrl: string, now: Date, matchPath: (id: string) => string): string[] {
  if (!event.scheduledStartUTC) return []
  const start = new Date(event.scheduledStartUTC)
  return [
    "BEGIN:VEVENT",
    `UID:${eventUid(event)}`,
    `DTSTAMP:${stamp(now)}`,
    event.dateOnly ? `DTSTART;VALUE=DATE:${event.scheduledStartUTC.slice(0, 10).replace(/-/g, "")}` : `DTSTART:${stamp(start)}`,
    `SUMMARY:${escapeText(eventTitle(event))}`,
    `DESCRIPTION:${escapeText(event.competition.name)}`,
    ...(event.venue ? [`LOCATION:${escapeText(event.venue)}`] : []),
    `URL:${siteUrl}${matchPath(event.id)}`,
    `STATUS:${CANCELLED.has(event.status) ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
  ]
}

export function buildCalendar(events: SportEvent[], options: { name: string; siteUrl: string; now?: Date; matchPath(id: string): string }): string {
  const now = options.now ?? new Date()
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FlacronSport//Match calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    ...events.flatMap((event) => vevent(event, options.siteUrl, now, options.matchPath)),
    "END:VCALENDAR",
  ]
  return `${lines.map(foldLine).join("\r\n")}\r\n`
}
