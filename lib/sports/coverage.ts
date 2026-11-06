// What staff have switched off. Stored in one document and held in memory for a
// minute, so the feed pays at most one read a minute however many people visit.

import { getAdminDb } from "@/lib/firebase-admin"
import type { DocDb } from "@/lib/doc-db"
import type { SportEvent, SportId } from "./types"

export const COVERAGE_DOC = "admin_config/coverage"
export const COVERAGE_SEEN = "coverage_seen"
const CACHE_MS = 60_000

export interface CompetitionRule {
  enabled?: false
  video?: false
}

/** Only what differs from the default is stored: everything is on unless switched off. */
export interface CoverageRules {
  sports: Partial<Record<SportId, false>>
  competitions: Record<string, CompetitionRule>
}

export type CoverageChange =
  | { type: "sport"; sportId: SportId; enabled: boolean }
  | { type: "competition"; sportId: SportId; name: string; enabled?: boolean; video?: boolean }

const OPEN: CoverageRules = { sports: {}, competitions: {} }

export const competitionKey = (sportId: SportId, name: string) => `${sportId}:${name}`

export const sportAllowed = (rules: CoverageRules, sportId: SportId) => rules.sports[sportId] !== false

export function eventAllowed(rules: CoverageRules, event: Pick<SportEvent, "sportId" | "competition">): boolean {
  return sportAllowed(rules, event.sportId) && rules.competitions[competitionKey(event.sportId, event.competition.name)]?.enabled !== false
}

export function videoAllowed(rules: CoverageRules, sportId: SportId, competition: string): boolean {
  const rule = rules.competitions[competitionKey(sportId, competition)]
  return sportAllowed(rules, sportId) && rule?.enabled !== false && rule?.video !== false
}

let cached: { rules: CoverageRules; at: number } | null = null
let loading: Promise<CoverageRules> | null = null

async function readRules(): Promise<CoverageRules> {
  const doc = await getAdminDb()?.doc(COVERAGE_DOC).get()
  const data = doc?.exists ? (doc.data() as Partial<CoverageRules>) : null
  return { sports: data?.sports ?? {}, competitions: data?.competitions ?? {} }
}

/** A failed read keeps the last rules, or leaves the feed as it is, rather than emptying it. */
export async function coverageRules(now: number = Date.now()): Promise<CoverageRules> {
  // The frontend reads filtered data from the backend and holds no database credentials.
  if (process.env.API_ORIGIN) return OPEN
  if (cached && now - cached.at < CACHE_MS) return cached.rules
  loading ??= readRules()
    .catch((error: unknown) => {
      console.error("Coverage rules not read", error instanceof Error ? error.message : "unknown")
      return cached?.rules ?? OPEN
    })
    .then((rules) => {
      cached = { rules, at: now }
      return rules
    })
    .finally(() => {
      loading = null
    })
  return loading
}

export function clearCoverageCache(): void {
  cached = null
}

function withoutDefaults(rule: { enabled?: boolean; video?: boolean }): CompetitionRule {
  return { ...(rule.enabled === false ? { enabled: false as const } : {}), ...(rule.video === false ? { video: false as const } : {}) }
}

export function applyCoverageChange(rules: CoverageRules, change: CoverageChange): CoverageRules {
  if (change.type === "sport") {
    const sports = { ...rules.sports }
    if (change.enabled) delete sports[change.sportId]
    else sports[change.sportId] = false
    return { ...rules, sports }
  }
  const key = competitionKey(change.sportId, change.name)
  const current = rules.competitions[key] ?? {}
  const next = withoutDefaults({ enabled: change.enabled ?? current.enabled, video: change.video ?? current.video })
  const competitions = { ...rules.competitions }
  if (Object.keys(next).length > 0) competitions[key] = next
  else delete competitions[key]
  return { ...rules, competitions }
}

export async function saveCoverageChange(db: DocDb, change: CoverageChange, actorUid: string, now: Date): Promise<CoverageRules> {
  const rules = await db.transaction(async (tx) => {
    const stored = await tx.get<Partial<CoverageRules>>(COVERAGE_DOC)
    const next = applyCoverageChange({ sports: stored?.sports ?? {}, competitions: stored?.competitions ?? {} }, change)
    tx.set(COVERAGE_DOC, { ...next, updatedAt: now.toISOString(), updatedBy: actorUid })
    return next
  })
  clearCoverageCache()
  return rules
}

export interface SeenCompetition {
  name: string
  country: string | null
  lastSeenAt: string
  events: number
  /** Listed by the video feed only, so only its video switch applies. */
  videoOnly?: boolean
}

export const seenPath = (sportId: SportId) => `${COVERAGE_SEEN}/${sportId}`

/** One small map per sport, so the job writes at most one document per sport. */
export function summarizeSeen(events: SportEvent[], at: string): Map<SportId, Record<string, SeenCompetition>> {
  const sports = new Map<SportId, Record<string, SeenCompetition>>()
  for (const event of events) {
    const row = sports.get(event.sportId) ?? {}
    const { name, country } = event.competition
    row[name] = { name, country, lastSeenAt: at, events: (row[name]?.events ?? 0) + 1 }
    sports.set(event.sportId, row)
  }
  return sports
}
