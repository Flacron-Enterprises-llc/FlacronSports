import { isMajorCompetition } from "@/lib/sports/priority"
import type { SportEvent } from "@/lib/sports/types"

/** Case and accents are ignored, so "Malaga" finds "Málaga". */
export const fold = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

export const containsText = (haystack: string, needle: string): boolean => fold(haystack).includes(fold(needle))

export function eventMatches(event: SportEvent, needle: string): boolean {
  return [event.competition.name, event.eventName ?? "", ...event.participants.map((participant) => participant.name)].some((text) => containsText(text, needle))
}

export interface CompetitionHit {
  id: string
  name: string
  sportId: SportEvent["sportId"]
  /** Games today. Zero for a competition found only in the full list. */
  today: number
}

/** Competitions on today's games, with the major ones first. One with no id cannot be followed or opened. */
export function competitionsToday(events: SportEvent[], accept: (name: string, country: string | null) => boolean): CompetitionHit[] {
  const found = new Map<string, CompetitionHit>()
  for (const event of events) {
    const { id, name, country } = event.competition
    if (!id || !accept(name, country)) continue
    const known = found.get(id)
    if (known) known.today += 1
    else found.set(id, { id, name, sportId: event.sportId, today: 1 })
  }
  return [...found.values()].sort((a, b) => Number(isMajorCompetition(b.name)) - Number(isMajorCompetition(a.name)) || b.today - a.today || a.name.localeCompare(b.name))
}
