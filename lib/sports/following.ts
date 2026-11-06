import type { SportEvent } from "./types"

/** Classified events name their entrants only in the result, so those count as following too. */
export function followsEvent(favorites: string[], event: SportEvent): boolean {
  if (favorites.length === 0) return false
  const entrants = event.score.kind === "classification" ? event.score.entries.map((entry) => entry.name) : []
  return [...event.participants.map((participant) => participant.name), ...entrants].some((name) => name !== "TBD" && favorites.includes(name))
}
