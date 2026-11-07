// Ties a clip to the site's own game. The two feeds spell clubs differently ("PSG", "Paris SG"),
// so names are folded and compared as sets of words. A wrong link would play the wrong game,
// so anything unclear stays unlinked.

import type { SportEvent } from "@/lib/sports/types"
import { competitionKey } from "./facets"

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
/** Far enough for a feed and a fixture to disagree on the day, too near for a return leg. */
const SAME_GAME_MS = 1.25 * DAY_MS
/** A club plays once in a day, so one sure name and the same kick-off are enough. */
const SAME_KICKOFF_MS = 2 * HOUR_MS

const LETTERS: Record<string, string> = { ß: "ss", ø: "o", ł: "l", đ: "d", ð: "d", æ: "ae", œ: "oe", ı: "i", þ: "th" }

// Club-form words, which either feed may or may not write.
const FORM_WORDS = new Set(["fc", "cf", "afc", "sc", "ssc", "ss", "as", "ac", "rc", "rcd", "cd", "ud", "sd", "sk", "fk", "kv", "bk", "cp", "ca", "ec", "se", "sv", "vfb", "vfl", "tsg", "bsc", "krc", "kaa", "gnk", "nk", "club", "clube", "de", "do", "da", "the"])
// Words naming a different side of the same club. "Arsenal" must never match "Arsenal Women".
const OTHER_SIDE = /^(?:women|w|femenino|feminin|feminine|frauen|ladies|ii|iii|b|c|reserves?|youth|u\d{2})$/

/** Names one feed shortens or translates, written as the longer feed's words. These keep every word. */
const SAME_CLUB: [RegExp, string][] = [
  // Without its "AC" this would read as a shorter form of "Inter Milan".
  [/^(?:ac )?milan$/, "ac milan"],
  [/^psg$|^paris (?:saint germain|sg)$/, "paris saint germain"],
  [/^(?:inter|inter milan|internazionale(?: milano)?)$/, "inter milan"],
  [/^crvena zvezda$|^red star(?: belgrade)?$/, "red star belgrade"],
  [/^wolves$|^wolverhampton(?: wanderers)?$/, "wolverhampton wanderers"],
  [/^spurs$|^tottenham(?: hotspur)?$/, "tottenham hotspur"],
  [/^atletico mg$|^atletico mineiro$/, "atletico mineiro"],
  [/^atletico pr$|^(?:club )?athletico(?: paranaense)?$/, "athletico paranaense"],
]

const CITY_NAMES: Record<string, string> = { praha: "prague", munchen: "munich", st: "saint", sint: "saint" }

/** Lower case, plain letters and no punctuation, so "F.C.Tokyo" and "FC Tokyo" read alike. */
export function plainName(name: string): string {
  const flat = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[ßøłđðæœıþ]/g, (letter) => LETTERS[letter])
  return flat.replace(/(?<=\b\p{L})\.(?=\p{L}\b)/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

function words(name: string): string[] {
  const plain = plainName(name)
  const known = SAME_CLUB.find(([pattern]) => pattern.test(plain))?.[1]
  const all = (known ?? plain).split(" ").map((word) => CITY_NAMES[word] ?? word)
  const kept = all.filter((word) => !FORM_WORDS.has(word))
  return known || kept.length === 0 ? all : kept
}

/** Same club, where one name may be a shorter form of the other. Another side of the club never counts. */
export function sameTeam(a: string, b: string): boolean {
  const [one, two] = [words(a), words(b)]
  const [short, long] = one.length <= two.length ? [one, two] : [two, one]
  if (!short.every((word) => long.includes(word))) return false
  return !long.some((word) => !short.includes(word) && OTHER_SIDE.test(word))
}

export interface ClipGame {
  home: string
  away: string
  competition: string
  dateUTC: string | null
}

const gap = (a: number, b: number) => Math.abs(a - b)

/** Both sides named: the nearest game, unless two are equally near. */
function byBothTeams(clip: ClipGame, games: SportEvent[], at: number): SportEvent | null {
  const found = games.filter(({ participants: [home, away] }) =>
    (sameTeam(clip.home, home.name) && sameTeam(clip.away, away.name)) || (sameTeam(clip.home, away.name) && sameTeam(clip.away, home.name)))
  if (found.length < 2) return found[0] ?? null
  const near = (event: SportEvent) => gap(Date.parse(event.scheduledStartUTC as string), at)
  const [first, second] = [...found].sort((a, b) => near(a) - near(b))
  return near(first) === near(second) ? null : first
}

/** One side named, in the same competition at the same kick-off. Covers a club the feeds name apart. */
function byOneTeam(clip: ClipGame, games: SportEvent[], at: number): SportEvent | null {
  const wanted = competitionKey(clip.competition)
  const found = games.filter((event) => {
    const [home, away] = event.participants
    return gap(Date.parse(event.scheduledStartUTC as string), at) <= SAME_KICKOFF_MS
      && competitionKey(event.competition.name) === wanted
      && (sameTeam(clip.home, home.name) !== sameTeam(clip.away, away.name))
  })
  return found.length === 1 ? found[0] : null
}

export function findGame(clip: ClipGame, events: SportEvent[]): SportEvent | null {
  const at = clip.dateUTC ? Date.parse(clip.dateUTC) : Number.NaN
  if (Number.isNaN(at) || !clip.home || !clip.away) return null
  const games = events.filter((event) => event.sportId === "football" && event.participants.length === 2 && event.scheduledStartUTC !== null && gap(Date.parse(event.scheduledStartUTC), at) <= SAME_GAME_MS)
  return byBothTeams(clip, games, at) ?? byOneTeam(clip, games, at)
}
