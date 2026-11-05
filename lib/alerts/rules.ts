import { getDictionary, type Locale } from "@/lib/i18n"
import type { AlertType, Preferences } from "@/lib/me/preferences-defaults"
import { eventTitle, hasResult, isDuel, resultLine } from "@/lib/sports/presentation"
import type { SportEvent } from "@/lib/sports/types"

export type DueAlert = Extract<AlertType, "start" | "final">
type Plan = "free" | "plus" | "premium"

const FREE_TYPES: readonly AlertType[] = ["start", "final"]
const MINUTE = 60_000
// One tick interval ahead, and a short grace behind so a late tick still fires
// without announcing a kickoff that happened hours ago.
const START_LEAD = 15 * MINUTE
const START_GRACE = 30 * MINUTE

const clockFormat = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })

/** The stored zone is free text, so an unknown one falls back to UTC instead of throwing. */
export function localClock(now: Date, timeZone: string): { hour: number; date: string } {
  let format: Intl.DateTimeFormat
  try {
    format = clockFormat(timeZone)
  } catch {
    format = clockFormat("UTC")
  }
  const parts = Object.fromEntries(format.formatToParts(now).map((part) => [part.type, part.value]))
  return { hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` }
}

/** The end hour is exclusive. A start after the end wraps past midnight. */
export function isQuietHour(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

export function dueAlerts(event: SportEvent, now: Date): DueAlert[] {
  const due: DueAlert[] = []
  const kickoff = event.scheduledStartUTC ? Date.parse(event.scheduledStartUTC) : Number.NaN
  const inWindow = now.getTime() >= kickoff - START_LEAD && now.getTime() <= kickoff + START_GRACE
  // A date-only event has no real start, so midnight must not announce one.
  if ((event.status === "scheduled" || event.status === "live") && inWindow && !event.dateOnly) due.push("start")
  if (event.status === "finished" && hasResult(event)) due.push("final")
  return due
}

export function followsEvent(favorites: string[], event: SportEvent): boolean {
  return event.participants.some((participant) => participant.name !== "TBD" && favorites.includes(participant.name))
}

export function planAllows(plan: Plan, type: AlertType): boolean {
  return plan !== "free" || FREE_TYPES.includes(type)
}

export function suppressionReason(prefs: Preferences, plan: Plan, type: DueAlert, now: Date): "muted" | "type_off" | "plan" | "quiet" | null {
  if (prefs.alerts.muted) return "muted"
  if (!prefs.alerts.types.includes(type)) return "type_off"
  if (!planAllows(plan, type)) return "plan"
  const { hour } = localClock(now, prefs.timeZone)
  return isQuietHour(hour, prefs.alerts.quietStart, prefs.alerts.quietEnd) ? "quiet" : null
}

function kickoffTime(iso: string, locale: Locale, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(iso))
  }
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")

export interface AlertContent {
  title: string
  body: string
  /** Same message without the score, for a reader who turned spoiler mode on later. */
  spoilerFreeBody: string
}

/** With spoiler mode on the score never reaches the stored record or the email. */
export function buildAlert(event: SportEvent, type: DueAlert, prefs: Preferences): AlertContent {
  const dictionary = getDictionary(prefs.locale)
  const { alerts: copy } = dictionary
  const duel = isDuel(event)
  const [home = "", away = ""] = duel ? event.participants.map((participant) => participant.name) : []
  const values = { home, away, event: eventTitle(event), competition: event.competition.name }

  if (type === "start") {
    const time = event.scheduledStartUTC ? kickoffTime(event.scheduledStartUTC, prefs.locale, prefs.timeZone) : ""
    const body = fill(duel ? copy.startBody : copy.eventStartBody, { ...values, time })
    return { title: fill(duel ? copy.startTitle : copy.eventStartTitle, values), body, spoilerFreeBody: body }
  }

  const spoilerFreeBody = fill(duel ? copy.finalSpoilerFree : copy.eventFinalSpoilerFree, values)
  const title = fill(duel ? copy.finalTitle : copy.eventFinalTitle, values)
  if (prefs.spoilerMode) return { title, body: spoilerFreeBody, spoilerFreeBody }
  const { score } = event
  if (score.kind === "team") return { title, body: fill(copy.finalBody, { ...values, homeScore: String(score.home), awayScore: String(score.away) }), spoilerFreeBody }
  const result = resultLine(event, dictionary)
  return { title, body: result ? fill(copy.eventFinalBody, { ...values, result }) : spoilerFreeBody, spoilerFreeBody }
}
