// Who takes part in an event, for the sports with no team record to look up. Kept apart
// from the feed code so the compare screen can read it in the browser.

import type { SportEvent, SportId } from "./types"

export const INDIVIDUAL_SPORTS = new Set<SportId>(["tennis", "combat-sports", "motorsport"])

/** Named sides, each bout on a card, and everyone classified or out in a race. */
export function entrantsOf(event: SportEvent): string[] {
  const names = event.participants.map((participant) => participant.name)
  if (event.details?.kind === "combat") names.push(...event.details.bouts.flatMap((bout) => bout.names))
  if (event.score.kind === "classification") names.push(...event.score.entries.map((entry) => entry.name), ...(event.score.out ?? []).map((entry) => entry.name))
  return [...new Set(names)].filter((name) => name && name !== "TBD")
}
