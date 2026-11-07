// Rugby: halves, overtime, and tries where the feed states them. The field inventory has
// the one result format, often left blank, and no timeline, statistics or lineups.

import type { RawEvent } from "../thesportsdb"
import type { RugbyDetails, RugbyStage, ScoreBreakdown, ScoreSegment } from "../types"
import { checked, headedPairs, type Phase, type Sides } from "./shared"

const HEADINGS = ["First Half", "Second Half", "Overtime"]
const OVERTIME_INDEX = HEADINGS.length - 1
// The fewest points a try can be worth in either code is four, so a count above that cannot be tries.
const POINTS_PER_TRY = 4

function halves(text: string, sides: Sides): ScoreSegment[] | null {
  const pairs = headedPairs(text, HEADINGS, sides)
  if (!pairs || pairs.slice(0, OVERTIME_INDEX).some((pair) => !pair)) return null
  return pairs.flatMap((pair, index): ScoreSegment[] => {
    if (!pair) return []
    const overtime = index === OVERTIME_INDEX
    return [{ kind: overtime ? "overtime" : "half", number: overtime ? 1 : index + 1, home: pair[0], away: pair[1] }]
  })
}

export function rugbyTries(homeExtra: number | null, awayExtra: number | null, sides: Sides): { home: number; away: number } | null {
  if (homeExtra === null || awayExtra === null) return null
  return homeExtra * POINTS_PER_TRY > sides.homeScore || awayExtra * POINTS_PER_TRY > sides.awayScore ? null : { home: homeExtra, away: awayExtra }
}

/** Tries can be known when the halves are not, so a game can have either or both. */
export function rugbyBreakdown(text: string | null | undefined, sides: Sides, tries: { home: number; away: number } | null): ScoreBreakdown | null {
  const segments = text ? halves(text, sides) : null
  const parsed = segments ? checked(segments, sides) : null
  if (!parsed && !tries) return null
  return { segments: parsed?.segments ?? [], ...(tries ? { tries } : {}) }
}

const PHASES: Record<string, Phase> = {
  "1H": { key: "first-half" },
  "2H": { key: "second-half" },
  HT: { key: "half-time" },
  ET: { key: "extra-time" },
  BT: { key: "extra-break" },
  PT: { key: "shootout" },
}

export const rugbyPhase = (code: string): Phase | null => PHASES[code] ?? null

// Kickoff, two 40-minute halves, the break and stoppages fit well inside this.
const SETTLED_AFTER_MS = 3 * 3_600_000
const SCHEDULE_HORIZON_MS = 30 * 86_400_000
const FINISHED_CODES = /^(?:FT|AET)$/i

const whole = (value: string | number | null | undefined) => {
  const parsed = value === null || value === undefined || value === "" ? NaN : Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

/**
 * A stored or live row with its own contradictions settled, before anything reads it.
 * - Some finished games keep "NS" with the final score filled in: Ireland 42-12 Argentina in
 *   the Nations Championship (2449603) and Wests Tigers 26-12 Penrith (2435645), both checked
 *   against match reports. Hours past kickoff, a score on such a row is the result.
 * - The source marks the last rounds of a season "CANC" before their dates are fixed: Top 14
 *   rounds 25 and 26 and URC round 18 read so in November 2026. A cancellation that far ahead is not one.
 * - The postponed flag stays on a game later played, as on Lions 34-22 Sharks (2282752).
 */
export function rugbyRow(raw: RawEvent, startUTC: string | null, now: Date): RawEvent {
  const status = (raw.strStatus ?? "").trim().toUpperCase()
  const start = startUTC ? Date.parse(startUTC) : NaN
  const [home, away] = [whole(raw.intHomeScore), whole(raw.intAwayScore)]
  const postponed = raw.strPostponed?.toLowerCase() === "yes"
  const scored = home !== null && away !== null && home + away > 0
  if ((status === "NS" || status === "") && scored && !postponed && Number.isFinite(start) && now.getTime() - start > SETTLED_AFTER_MS) return { ...raw, strStatus: "FT" }
  if (status === "CANC" && Number.isFinite(start) && start - now.getTime() > SCHEDULE_HORIZON_MS) return { ...raw, strStatus: "NS" }
  if (FINISHED_CODES.test(status) && postponed) return { ...raw, strPostponed: "no" }
  return raw
}

// Every rugby competition the source lists, by its id, so no game is called union or league by guesswork.
const LEAGUE_CODE = new Set(["4415", "4416", "4589", "4981", "5806", "5807", "5808", "5834", "5835"])
const SEVENS = new Set(["5037", "5370"])
const UNION = new Set([
  "4414", "4417", "4430", "4446", "4550", "4551", "4574", "4714", "4722", "4983", "4984", "4985", "4986", "5069", "5070", "5082", "5165", "5166", "5167",
  "5168", "5169", "5170", "5171", "5172", "5173", "5278", "5418", "5479", "5480", "5512", "5558", "5559", "5560", "5563", "5682", "5695", "5701", "5852",
  "5853", "5854", "5855", "5856", "5857", "5933",
])

export function rugbyCode(leagueId: string | null | undefined): RugbyDetails["code"] {
  const id = leagueId ?? ""
  return LEAGUE_CODE.has(id) ? "league" : SEVENS.has(id) ? "sevens" : UNION.has(id) ? "union" : null
}

// Round codes above the numbered rounds, as filed in full seasons from 2025 to 2026. Each league uses its own.
const PRESEASON = 500
const STAGES: Record<number, RugbyStage> = { 125: "quarter", 150: "semi", 160: "playoff", 200: "final" }
const LEAGUE_STAGES: Record<string, Record<number, RugbyStage>> = {
  // NRL finals: week one (125), semi-finals (150), preliminary finals (180), grand final (200).
  "4416": { 125: "qualifying-final", 150: "semi", 180: "preliminary-final", 200: "grand-final" },
  "4415": { 150: "semi", 160: "eliminator", 200: "grand-final" },
  "4589": { 150: "semi", 160: "playoff", 200: "grand-final" },
  // The World Cups play their bronze final in the week of the final.
  "4574": { ...STAGES, 160: "third-place" },
  "5682": { ...STAGES, 160: "third-place" },
  "4551": { 150: "semi", 160: "quarter", 200: "final" },
}
const MOST_ROUNDS = 60
// The Nations Championship files every game in a group "N", which is no group a fan would know.
const NO_GROUPS = new Set(["5852"])

const clean = (text: string | null | undefined) => text?.trim() || null

export function rugbyDetails(raw: RawEvent): RugbyDetails {
  const id = raw.idLeague ?? ""
  const round = Number(raw.intRound)
  const spectators = Number(raw.intSpectators)
  return {
    kind: "rugby",
    code: rugbyCode(id),
    round: Number.isInteger(round) && round > 0 && round <= MOST_ROUNDS ? round : null,
    stage: round === PRESEASON ? "preseason" : ((LEAGUE_STAGES[id] ?? STAGES)[round] ?? null),
    group: NO_GROUPS.has(id) ? null : clean(raw.strGroup),
    season: clean(raw.strSeason),
    city: clean(raw.strCity),
    country: clean(raw.strCountry),
    spectators: Number.isInteger(spectators) && spectators > 0 ? spectators : null,
  }
}
