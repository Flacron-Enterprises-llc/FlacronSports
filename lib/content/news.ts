// What the News page lists. Each match keeps one document per report type, and a
// reader should see the fullest one: a recap stands in for the shorter result, and
// either replaces the preview.

import type { Report } from "./reports"

const PREVIEW_GRACE_MS = 6 * 3_600_000

export interface NewsFilters {
  q?: string
  team?: string
  competition?: string
}

export function visibleReports<T extends Pick<Report, "matchId" | "type" | "eventDateUTC">>(reports: T[], now: Date = new Date()): T[] {
  const byMatch = new Map<string, Set<string>>()
  for (const report of reports) byMatch.set(report.matchId, (byMatch.get(report.matchId) ?? new Set()).add(report.type))
  return reports.filter((report) => {
    const types = byMatch.get(report.matchId)
    if (report.type === "result") return !types?.has("recap")
    if (report.type !== "preview") return true
    if (types?.has("result") || types?.has("recap")) return false
    return !report.eventDateUTC || Date.parse(report.eventDateUTC) + PREVIEW_GRACE_MS > now.getTime()
  })
}

export function filterReports<T extends Pick<Report, "title" | "competition" | "participants">>(reports: T[], filters: NewsFilters): T[] {
  const needle = filters.q?.trim().toLowerCase()
  return reports.filter((report) =>
    (!filters.team || report.participants.includes(filters.team)) &&
    (!filters.competition || report.competition === filters.competition) &&
    (!needle || [report.title, report.competition, ...report.participants].some((text) => text.toLowerCase().includes(needle))),
  )
}

/** Busiest first, so the list opens on what has the most to read. */
export function reportCompetitions(reports: Pick<Report, "competition">[]): string[] {
  const counts = new Map<string, number>()
  for (const { competition } of reports) if (competition) counts.set(competition, (counts.get(competition) ?? 0) + 1)
  return [...counts].sort(([a, left], [b, right]) => right - left || a.localeCompare(b)).map(([name]) => name)
}
