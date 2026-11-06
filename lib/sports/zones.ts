export interface StandingZone {
  /** The provider's own words. */
  label: string
  /** "1-4", or "1-4, 6" when the places are not together. */
  places: string
  tone: "first" | "second" | "third" | "fourth" | "fifth" | "down"
}

const UP_TONES: StandingZone["tone"][] = ["first", "second", "third", "fourth", "fifth"]

function placeRanges(ranks: number[]): string {
  const sorted = [...new Set(ranks)].sort((a, b) => a - b)
  const ranges: [number, number][] = []
  for (const rank of sorted) {
    const last = ranges.at(-1)
    if (last && rank === last[1] + 1) last[1] = rank
    else ranges.push([rank, rank])
  }
  return ranges.map(([from, to]) => (from === to ? String(from) : `${from}-${to}`)).join(", ")
}

/** Top of the table first. The tones are for telling zones apart and say nothing the label does not. */
export function standingZones(rows: { rank: number | null; zone: string | null }[]): StandingZone[] {
  const zones = new Map<string, number[]>()
  for (const { rank, zone } of rows) {
    if (zone && rank !== null) zones.set(zone, [...(zones.get(zone) ?? []), rank])
  }
  let up = 0
  return [...zones.entries()]
    .sort(([, a], [, b]) => Math.min(...a) - Math.min(...b))
    .map(([label, ranks]) => ({ label, places: placeRanges(ranks), tone: /relegation/i.test(label) ? ("down" as const) : UP_TONES[up++ % UP_TONES.length] }))
}
