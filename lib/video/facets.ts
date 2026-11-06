// Watch filters per sport. Options are read from what Watch really holds, each one
// leaving out only its own filter, so every option offered returns something.

import type { SportEvent, SportId } from "@/lib/sports/types"

export type FacetKey = "competition" | "team" | "athlete" | "tournament" | "race" | "session" | "series" | "format"

export const SPORT_FACETS: Record<SportId, FacetKey[]> = {
  football: ["competition", "team"],
  basketball: ["competition", "team"],
  "american-football": ["competition", "team"],
  baseball: ["competition", "team"],
  "ice-hockey": ["competition", "team"],
  rugby: ["competition", "team"],
  volleyball: ["competition", "team"],
  cricket: ["competition", "series", "format", "team"],
  tennis: ["competition", "tournament", "athlete"],
  "combat-sports": ["competition", "athlete"],
  motorsport: ["competition", "race", "session"],
}

export const FACET_KEYS: FacetKey[] = ["competition", "team", "athlete", "tournament", "race", "session", "series", "format"]

export type FacetValues = Partial<Record<FacetKey, string[]>>
export type FacetChoice = Partial<Record<FacetKey, string>>

export interface WatchFacet {
  key: FacetKey
  options: string[]
}

export interface WatchItem<T> {
  value: T
  facets: FacetValues
  /** What the free search reads. */
  text: (string | null | undefined)[]
}

export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

const CLIP_COUNTRIES: Record<string, string> = {
  england: "english", spain: "spanish", italy: "italian", germany: "german", france: "french", portugal: "portuguese",
  netherlands: "dutch", brazil: "brazilian", argentina: "argentinian", scotland: "scottish", turkey: "turkish",
}
const CLIP_CUPS = new Set(["champions league", "europa league", "conference league"])

/** Clips write "ENGLAND: Premier League" where fixtures write "English Premier League". */
export function competitionKey(name: string): string {
  const [prefix, rest] = fold(name).split(/:\s*/, 2)
  const text = rest === undefined ? prefix : CLIP_CUPS.has(prefix) ? `uefa ${prefix}` : `${CLIP_COUNTRIES[prefix] ?? prefix} ${rest}`
  return text.replace(/\s+/g, "")
}

const valueKey = (key: FacetKey, value: string) => (key === "competition" ? competitionKey(value) : fold(value))

function chosen<T>(item: WatchItem<T>, choice: FacetChoice, skip?: FacetKey): boolean {
  return FACET_KEYS.every((key) => {
    const wanted = choice[key]
    if (!wanted || key === skip) return true
    const target = valueKey(key, wanted)
    return (item.facets[key] ?? []).some((value) => valueKey(key, value) === target)
  })
}

export function matchesWatch<T>(item: WatchItem<T>, choice: FacetChoice, query = ""): boolean {
  const needle = fold(query)
  return chosen(item, choice) && (!needle || item.text.some((text) => text && fold(text).includes(needle)))
}

/** Each filter's options are what is left with every other filter applied. */
export function buildFacets<T>(keys: FacetKey[], items: WatchItem<T>[], choice: FacetChoice, query = ""): WatchFacet[] {
  const needle = fold(query)
  const searched = needle ? items.filter((item) => item.text.some((text) => text && fold(text).includes(needle))) : items
  return keys.flatMap((key) => {
    const names = new Map<string, string>()
    for (const item of searched) {
      if (!chosen(item, choice, key)) continue
      for (const value of item.facets[key] ?? []) if (value.trim()) names.set(valueKey(key, value), value)
    }
    return names.size > 0 ? [{ key, options: [...names.values()].sort((a, b) => a.localeCompare(b)) }] : []
  })
}

// The feed's cricket competitions state their format by name, or are single-format by rule.
const CRICKET_FORMATS: [RegExp, string][] = [
  [/\btest\b/i, "Test"],
  [/sheffield shield|county championship/i, "First-class"],
  [/the hundred/i, "The Hundred"],
  [/one day|\bodi\b|cricket world cup|champions trophy/i, "ODI"],
  [/twenty20|\bt20|\bsa20\b|big bash|premier league|super smash|super league|major league cricket|shpageeza|commonwealth games/i, "T20"],
]

const BILATERAL = /international series|test match series|test championship/i

export const cricketFormat = (competition: string): string | null => CRICKET_FORMATS.find(([pattern]) => pattern.test(competition))?.[1] ?? null

/** Internationals sit in one competition per format, so the two sides are what name a series. */
function cricketSeries(event: SportEvent): string | null {
  const sides = event.participants.map((item) => item.name.replace(/\s+cricket$/i, "")).filter((name) => name !== "TBD")
  return BILATERAL.test(event.competition.name) && sides.length === 2 ? [...sides].sort((a, b) => a.localeCompare(b)).join(" vs ") : null
}

const names = (event: SportEvent) => event.participants.map((item) => item.name).filter((name) => name && name !== "TBD")
const list = (value: string | null | undefined) => (value ? [value] : [])

/** A game yet to be drawn keeps "Tournament A vs B" as its title. Names of more than one word keep their particle. */
export function splitTennisTitle(title: string): { tournament: string; names: [string, string] } | null {
  const match = title.match(/^(.+?)\s+((?:(?:de|del|van|von|der|da|di|le|la)\s+)*\S+)\s+vs\.?\s+(.+)$/i)
  return match ? { tournament: match[1].trim(), names: [match[2].trim(), match[3].trim()] } : null
}

const SESSION = /\s+((?:free\s+)?practice(?:\s+\d+)?|fp\d|(?:sprint\s+)?(?:qualifying|shootout)(?:\s+\d+)?|sprint(?:\s+race)?|warm[\s-]?up|race\s+\d+|hyperpole)$/i

/** Sessions add a word to the weekend's name, and the race itself carries the bare name. */
export function splitSession(name: string): { race: string; session: string } {
  const match = name.match(SESSION)
  if (match) return { race: name.slice(0, match.index).trim(), session: match[1].replace(/\s+/g, " ") }
  // MotoGP writes "Qatar GP" beside "Qatar Sprint Race", and its classes add their own name.
  return { race: name.replace(/\s+(?:GP|Moto[23E])$/i, "").trim(), session: "Race" }
}

export function eventFacets(event: SportEvent): FacetValues {
  const competition = [event.competition.name]
  switch (event.sportId) {
    case "tennis": {
      const split = event.participants.length === 0 && event.eventName ? splitTennisTitle(event.eventName) : null
      return { competition, tournament: list(split?.tournament ?? event.eventName), athlete: split ? split.names : names(event).flatMap((name) => name.split("/").map((part) => part.trim())) }
    }
    case "combat-sports":
      return { competition, athlete: names(event) }
    case "motorsport": {
      if (!event.eventName) return { competition }
      const { race, session } = splitSession(event.eventName)
      return { competition, race: [race], session: [session] }
    }
    case "cricket":
      return { competition, team: names(event), series: list(cricketSeries(event)), format: list(cricketFormat(event.competition.name)) }
    default:
      return { competition, team: names(event) }
  }
}

/** Clip titles read "Home - Away". */
export const clipFacets = (title: string, competition: string): FacetValues => ({
  competition: list(competition),
  team: title.split(/\s+-\s+/).map((name) => name.trim()).filter(Boolean),
})
