import type { EventReminder, FollowedLeague, Preferences } from "@/lib/me/preferences-defaults"
import { eventTitle } from "./presentation"
import type { SportEvent } from "./types"

/** Classified events name their entrants only in the result, so those count as following too. */
export function followsEvent(favorites: string[], event: SportEvent): boolean {
  if (favorites.length === 0) return false
  const entrants = event.score.kind === "classification" ? event.score.entries.map((entry) => entry.name) : []
  return [...event.participants.map((participant) => participant.name), ...entrants].some((name) => name !== "TBD" && favorites.includes(name))
}

export type Following = Pick<Preferences, "favorites" | "leagues" | "players">

export const sameLeague = (league: Pick<FollowedLeague, "id">, event: SportEvent): boolean => league.id === event.competition.id

/** A followed player brings their team's games along, so the two lists never disagree. */
const followedNames = ({ favorites, players }: Following): string[] => [...favorites, ...players.flatMap((player) => (player.team ? [player.team] : []))]

export function isFollowed(following: Following, event: SportEvent): boolean {
  return followsEvent(followedNames(following), event) || following.leagues.some((league) => sameLeague(league, event))
}

export const followsAnything = ({ favorites, leagues, players }: Following): boolean => favorites.length + leagues.length + players.length > 0

/** Lower comes first: the member's own team order, then players' teams, then leagues in their order. */
export function followPriority(following: Following, event: SportEvent): number {
  const names = followedNames(following)
  const named = names.findIndex((name) => followsEvent([name], event))
  if (named !== -1) return named
  const league = following.leagues.findIndex((item) => sameLeague(item, event))
  return league === -1 ? Number.MAX_SAFE_INTEGER : names.length + league
}

/** Moves one item, and leaves the list alone at either end. */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

const REMINDER_KEEP_MS = 86_400_000

/** Adds or removes the bell. Old reminders go at the same time, so the list cannot fill up. */
export function toggleReminder(reminders: EventReminder[], event: SportEvent, now: Date = new Date()): EventReminder[] {
  const current = reminders.filter((item) => !item.startUTC || Date.parse(item.startUTC) > now.getTime() - REMINDER_KEEP_MS)
  if (current.some((item) => item.eventId === event.id)) return current.filter((item) => item.eventId !== event.id)
  return [...current, { eventId: event.id, title: eventTitle(event).slice(0, 200), startUTC: event.scheduledStartUTC }]
}

/** Only a game that has not started and has a real start time can be reminded about. */
export const canRemind = (event: SportEvent, now: Date = new Date()): boolean =>
  event.status === "scheduled" && !event.dateOnly && Boolean(event.scheduledStartUTC) && Date.parse(event.scheduledStartUTC as string) > now.getTime()
