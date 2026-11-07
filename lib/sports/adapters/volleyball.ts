// Volleyball: sets. The final score counts sets won and the points are in strResult. The
// field inventory shows the feed never fills its fourth heading, which it spells "Forth",
// so a four or five set game has a real gap there. It stays empty rather than being guessed.

import type { RawEvent } from "../thesportsdb"
import type { ScoreBreakdown, ScoreSegment, VolleyballDetails } from "../types"
import { headedPairs, numbered, type Phase, type Sides } from "./shared"

const HEADINGS = ["First", "Second", "Third", "Forth", "Fifth"]
const FEWEST_SETS = 3
const SETS_TO_WIN = 3

export function volleyballBreakdown(text: string, sides: Sides): ScoreBreakdown | null {
  const pairs = headedPairs(text, HEADINGS, sides)
  if (!pairs) return null
  const last = pairs.reduce((found, pair, index) => (pair ? index : found), -1)
  if (last < FEWEST_SETS - 1) return null
  // Sets played come from the final score, so a set the feed left empty shows as a gap and is not dropped.
  const played = Math.min(sides.homeScore + sides.awayScore, HEADINGS.length)
  const segments = Array.from({ length: Math.max(last + 1, played) }, (_, index): ScoreSegment => ({ kind: "set", number: index + 1, home: pairs[index]?.[0] ?? null, away: pairs[index]?.[1] ?? null }))
  const won = (side: "home" | "away", other: "home" | "away") => segments.filter((item) => (item[side] ?? 0) > (item[other] ?? 0)).length
  return won("home", "away") <= sides.homeScore && won("away", "home") <= sides.awayScore ? { segments } : null
}

export const volleyballPhase = (code: string): Phase | null => numbered(code, /^S([1-5])$/, "set")

const GOLDEN_SET_POINTS = 15

/**
 * The golden set is filed as a game of its own, the same two teams on the same day, with
 * its points as the score: Projekt Warsaw won Trentino's 11-15 on 11 March 2026 (2447950).
 * Only a finished set to 15 reads so, and no match score in sets can.
 */
export function isGoldenSet(home: number | null, away: number | null): boolean {
  if (home === null || away === null) return false
  const [high, low] = [Math.max(home, away), Math.min(home, away)]
  return high >= GOLDEN_SET_POINTS && high - low >= 2 && (high === GOLDEN_SET_POINTS || high - low === 2)
}

const count = (value: string | number | null | undefined) => {
  const parsed = value === null || value === undefined || value === "" ? NaN : Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

const spaced = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim()

/** A score only a finished match can have: one side on three sets, the other below. */
const finalSets = (home: number | null, away: number | null) => home !== null && away !== null && Math.max(home, away) === SETS_TO_WIN && Math.min(home, away) < SETS_TO_WIN

// A cancellation close at hand is real; one weeks away is the PlusLiga's untimed placeholder.
const UNTIMED_AFTER_MS = 30 * 86_400_000
// The PlusLiga's placeholder is so regular, a 17:00 "CANC", that any distance ahead reads as untimed.
const PLUSLIGA = "5619"

/** A stored or live row with its own contradictions settled, before anything reads it. */
export function volleyballRow(raw: RawEvent, now: Date): RawEvent {
  const [home, away] = [spaced(raw.strHomeTeam), spaced(raw.strAwayTeam)]
  const awayFirst = `${away} vs ${home}`
  // Some rows title a game "away vs home", and then the score follows the title, as the result
  // text does: Zawiercie beat Lube 3-0 on 2 April 2026 (2435812), which the row gives to Lube.
  // As in basketball and hockey the scores turn, so every reader of the row gets the winner right.
  const reversed = Boolean(home && away) && home !== away && spaced(raw.strEvent) === awayFirst && spaced(raw.strFilename).endsWith(awayFirst)
  const row: RawEvent = reversed && !raw.fromLive ? { ...raw, intHomeScore: raw.intAwayScore, intAwayScore: raw.intHomeScore } : raw
  const status = (row.strStatus ?? "").trim().toUpperCase()
  const start = Date.parse(`${(row.strTimestamp ?? "").trim().replace(" ", "T")}${/(Z|[+-]\d{2}:?\d{2})$/.test(row.strTimestamp ?? "") ? "" : "Z"}`)
  const [homeSets, awaySets] = [count(row.intHomeScore), count(row.intAwayScore)]
  // The PlusLiga marks every game it has not yet timed "CANC", at 17:00 on the round's nominal
  // Saturday: all 146 from round 6 on, read on 7 November 2026. Nothing is called off before it
  // is played, so a future one is a game whose time is still to be set.
  const placeholder = row.idLeague === PLUSLIGA && row.strTime?.trim() === "17:00:00"
  if (status === "CANC" && start > now.getTime() + (placeholder ? 0 : UNTIMED_AFTER_MS) && homeSets === null && awaySets === null && row.dateEvent) {
    return { ...row, strStatus: "NS", strTime: "00:00:00", strTimeLocal: null, strTimestamp: `${row.dateEvent.trim()}T00:00:00` }
  }
  // A few Greek rows carry a match score with no status at all. Three sets is the end of a match.
  if (!status && start < now.getTime() && finalSets(homeSets, awaySets)) return { ...row, strStatus: "FT" }
  return row
}

// Round codes above the numbered rounds. The European cups use 160 for a playoff round as well
// as their third place match, so there it says nothing unless the row names the game.
const STAGES: Record<number, VolleyballDetails["stage"]> = { 125: "quarter", 150: "semi", 160: "third-place", 200: "final" }
const CEV = /^CEV\b/i
const MOST_ROUNDS = 60

const clean = (text: string | null | undefined) => text?.trim() || null

export function volleyballDetails(raw: RawEvent, finished: boolean): VolleyballDetails {
  const round = Number(raw.intRound)
  const named = /third place/i.test(raw.strDescriptionEN ?? "")
  const coded = STAGES[round] ?? null
  return {
    kind: "volleyball",
    round: Number.isInteger(round) && round > 0 && round <= MOST_ROUNDS ? round : null,
    stage: named ? "third-place" : coded === "third-place" && CEV.test(raw.strLeague ?? "") ? null : coded,
    group: clean(raw.strGroup),
    season: clean(raw.strSeason),
    city: clean(raw.strCity),
    country: clean(raw.strCountry),
    goldenSet: finished && isGoldenSet(count(raw.intHomeScore), count(raw.intAwayScore)),
  }
}
