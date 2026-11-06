// What the News page lists. Each match keeps one document per report type, and a
// reader should see the fullest one: a recap stands in for the shorter result, and
// either replaces the preview.

import { interleave } from "@/lib/sports/priority"
import type { Report, ReportType } from "./reports"

const PREVIEW_GRACE_MS = 6 * 3_600_000

export interface NewsFilters {
  q?: string
  team?: string
  competition?: string
  type?: ReportType
}

export const NEWS_PAGE_SIZE = 12

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

/** Each sport's own daily roundup. The all-sports feed has the shared one, which already covers them. */
export const isSportRoundup = (report: Pick<Report, "type" | "sportId">): boolean => report.type === "roundup" && report.sportId !== "all"

/** Newest day first, with the sports taking turns inside a day, so one sport's full card cannot fill the page. */
export function balanceBySport<T extends Pick<Report, "sportId" | "publishedAt">>(reports: T[]): T[] {
  const days = new Map<string, T[]>()
  for (const report of reports) {
    const day = (report.publishedAt ?? "").slice(0, 10)
    days.set(day, [...(days.get(day) ?? []), report])
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).flatMap(([, list]) => interleave(list, (report) => report.sportId))
}

export function filterReports<T extends Pick<Report, "title" | "competition" | "participants" | "type">>(reports: T[], filters: NewsFilters): T[] {
  const needle = filters.q?.trim().toLowerCase()
  return reports.filter((report) =>
    (!filters.team || report.participants.includes(filters.team)) &&
    (!filters.competition || report.competition === filters.competition) &&
    (!filters.type || report.type === filters.type) &&
    (!needle || [report.title, report.competition, ...report.participants].some((text) => text.toLowerCase().includes(needle))),
  )
}

/** Teams and athletes named in single-game reports. A roundup names everyone from that day. */
export function reportTeams(reports: Pick<Report, "participants" | "type">[]): string[] {
  const names = new Set(reports.filter((report) => report.type !== "roundup").flatMap((report) => report.participants))
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b))
}

export function pageOfReports<T>(reports: T[], page: number, size = NEWS_PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(reports.length / size))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages)
  return { items: reports.slice((current - 1) * size, current * size), page: current, pages }
}

/** Busiest first, so the list opens on what has the most to read. */
export function reportCompetitions(reports: Pick<Report, "competition">[]): string[] {
  const counts = new Map<string, number>()
  for (const { competition } of reports) if (competition) counts.set(competition, (counts.get(competition) ?? 0) + 1)
  return [...counts].sort(([a, left], [b, right]) => right - left || a.localeCompare(b)).map(([name]) => name)
}
