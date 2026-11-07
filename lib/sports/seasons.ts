// Season views built from the provider's own round numbers. It links no game to the
// next one, so a cup is shown round by round and never as an inferred bracket tree.

import { normalizeEvent, toUtc, type RawEvent } from "./thesportsdb"
import type { EventStatus, SportEvent } from "./types"

/** Checked against real seasons on 2026-11-07. */
export const RACE_SERIES = [
  { id: "4370", name: "Formula 1" },
  { id: "4407", name: "MotoGP" },
  { id: "4413", name: "WEC" },
  { id: "4371", name: "Formula E" },
  { id: "4373", name: "IndyCar Series" },
  { id: "4393", name: "NASCAR Cup Series" },
  { id: "4573", name: "NASCAR O'Reilly Auto Parts Series" },
  { id: "4486", name: "Formula 2" },
  { id: "4487", name: "Formula 3" },
  { id: "4436", name: "Moto2" },
  { id: "4437", name: "Moto3" },
  { id: "4454", name: "SBK" },
  { id: "4409", name: "WRC" },
  { id: "4372", name: "BTCC" },
  { id: "4438", name: "DTM" },
  { id: "4489", name: "V8 Supercars" },
  { id: "4488", name: "IMSA SportsCar Championship" },
  { id: "4412", name: "Super GT series" },
  { id: "4410", name: "British GT Championship" },
  { id: "4447", name: "Dakar Rally" },
]

/** Football cups whose knockout rounds the feed held whole in the check on 2026-11-07. */
export const CUP_COMPETITIONS = [
  { id: "4429", name: "FIFA World Cup" },
  { id: "4480", name: "UEFA Champions League" },
  { id: "4481", name: "UEFA Europa League" },
  { id: "4482", name: "FA Cup" },
  { id: "4570", name: "EFL Cup" },
  { id: "4501", name: "Copa Libertadores" },
  { id: "4724", name: "Copa Sudamericana" },
  { id: "4502", name: "UEFA European Championships" },
  { id: "4499", name: "Copa America" },
  { id: "4565", name: "FIFA Women's World Cup" },
  { id: "4889", name: "UEFA Women's Champions League" },
  { id: "4720", name: "CAF Champions League" },
]

export interface SeasonView<T> {
  state: "ok" | "stale" | "empty" | "unavailable" | "withheld"
  competition: string | null
  season: string | null
  items: T[]
  fetchedAt: string
}

export interface RaceSession {
  id: string
  /** Null when this session carries the weekend's own name, as the main race does. */
  name: string | null
  startUTC: string | null
  dateOnly: boolean
  status: EventStatus
}

export interface RaceWeekend {
  key: string
  round: number | null
  name: string
  venue: string | null
  country: string | null
  over: boolean
  sessions: RaceSession[]
}

const roundOf = (raw: RawEvent): number | null => {
  const round = Number(raw.intRound)
  return Number.isInteger(round) && round > 0 ? round : null
}

const startOf = (raw: RawEvent) => toUtc(raw.strTimestamp) ?? ""

/** The words every session shares, which is the weekend's name in all the series checked. */
function sharedName(names: string[]): string {
  const [first, ...others] = names.map((name) => name.split(/\s+/))
  let length = first.length
  for (const words of others) {
    let same = 0
    while (same < length && same < words.length && words[same] === first[same]) same += 1
    length = same
  }
  return first.slice(0, length).join(" ")
}

const DAY_MS = 86_400_000
const OVER_STATUSES: EventStatus[] = ["finished", "canceled", "abandoned"]

/** Many sessions never receive a stated status, so one well past its start counts as over. */
const sessionOver = (session: RaceSession, now: Date) =>
  OVER_STATUSES.includes(session.status) || (session.startUTC !== null && Date.parse(session.startUTC) + 2 * DAY_MS < now.getTime())

/** The status to show for a session, since a past one can still read as upcoming. */
export const sessionStatus = (session: RaceSession, now: Date): EventStatus =>
  session.status === "scheduled" && sessionOver(session, now) ? "finished" : session.status

export function raceWeekends(rows: RawEvent[], now: Date = new Date()): RaceWeekend[] {
  const groups = new Map<string, RawEvent[]>()
  for (const raw of rows) {
    if (!raw.strEvent?.trim()) continue
    const round = roundOf(raw)
    // Round 0 holds one-off events on unrelated dates, so each stands alone.
    const key = round === null ? `event-${raw.idEvent}` : `round-${round}`
    groups.set(key, [...(groups.get(key) ?? []), raw])
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const sorted = [...group].sort((a, b) => startOf(a).localeCompare(startOf(b)))
      const names = sorted.map((raw) => (raw.strEvent as string).trim())
      const shared = sharedName(names)
      const shortest = [...names].sort((a, b) => a.length - b.length)[0]
      const sessions = sorted.map((raw, index): RaceSession => {
        const event: SportEvent = normalizeEvent(raw, "motorsport", now)
        const rest = shared ? names[index].slice(shared.length).trim() : names[index]
        return { id: event.id, name: sorted.length > 1 ? rest || null : null, startUTC: event.scheduledStartUTC, dateOnly: event.dateOnly === true, status: event.status }
      })
      return {
        key,
        round: roundOf(sorted[0]),
        name: shared || shortest,
        venue: sorted.find((raw) => raw.strVenue?.trim())?.strVenue?.trim() ?? sorted.find((raw) => raw.strCity?.trim())?.strCity?.trim() ?? null,
        country: sorted.find((raw) => raw.strCountry?.trim())?.strCountry?.trim() ?? null,
        over: sessions.every((session) => sessionOver(session, now)),
        sessions,
      }
    })
    .sort((a, b) => (a.sessions[0].startUTC ?? "").localeCompare(b.sessions[0].startUTC ?? ""))
}

export type KnockoutKey = "round64" | "round32" | "round16" | "quarter" | "semi" | "third" | "final"

/**
 * What the source's round codes meant in the football cups checked. Other sports and
 * leagues reuse the same numbers for match weeks, so this applies to CUP_COMPETITIONS only.
 */
const KNOCKOUT: { code: number; key: KnockoutKey; fewest: number; most?: number }[] = [
  { code: 64, key: "round64", fewest: 1 },
  { code: 32, key: "round32", fewest: 1 },
  { code: 16, key: "round16", fewest: 8 },
  { code: 125, key: "quarter", fewest: 4 },
  { code: 150, key: "semi", fewest: 2 },
  { code: 160, key: "third", fewest: 1, most: 1 },
  { code: 200, key: "final", fewest: 1 },
]

/** Stages that need the one before them, so a stage missing from the feed shows as a gap. */
const CHAINED = [125, 150, 200]

export interface KnockoutRound<T> {
  key: KnockoutKey
  games: T[]
}

/**
 * Null when the feed does not hold the knockout stage properly: a round is short, a stage
 * is missing, or games with no round number fall inside it, which is where several cups
 * file their late rounds. Showing those would present a partial draw as the whole one.
 */
export function knockoutRounds(rows: RawEvent[]): KnockoutRound<RawEvent>[] | null {
  const byCode = new Map<number, RawEvent[]>()
  for (const raw of rows) {
    const code = Number(raw.intRound)
    byCode.set(code, [...(byCode.get(code) ?? []), raw])
  }
  const named = KNOCKOUT.filter(({ code, most }) => {
    const size = byCode.get(code)?.length ?? 0
    return size > 0 && (most === undefined || size <= most)
  })
  if (named.length === 0) return null
  if (named.some(({ code, fewest }) => (byCode.get(code) as RawEvent[]).length < fewest)) return null

  const present = new Set(named.map(({ code }) => code))
  if (CHAINED.some((code, index) => index > 0 && present.has(code) && !present.has(CHAINED[index - 1]))) return null

  const stageStart = named.flatMap(({ code }) => (byCode.get(code) as RawEvent[]).map(startOf)).sort()[0]
  const unnamed = rows.filter((raw) => !Number(raw.intRound))
  if (unnamed.some((raw) => startOf(raw) >= stageStart)) return null

  return named.map(({ code, key }) => ({ key, games: [...(byCode.get(code) as RawEvent[])].sort((a, b) => startOf(a).localeCompare(startOf(b))) }))
}

/** "2026-2027" gives "2025-2026" and "2026" gives "2025". */
export function previousSeason(season: string): string | null {
  if (!/^\d{4}(-\d{4})?$/.test(season)) return null
  return season.split("-").map((value) => Number(value) - 1).join("-")
}
