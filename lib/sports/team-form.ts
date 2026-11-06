import type { SportEvent } from "./types"

export type FormResult = "win" | "draw" | "loss"

const FORM_LENGTH = 5

/** Worked out from finished games with a full score, newest first. Anything else is left out. */
export function teamForm(events: SportEvent[], team: string, limit = FORM_LENGTH): { eventId: string; result: FormResult }[] {
  const wanted = team.toLowerCase()
  return events
    .filter((event) => event.status === "finished" && event.score.kind === "team")
    .sort((a, b) => (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? ""))
    .flatMap((event) => {
      const index = event.participants.findIndex((participant) => participant.name.toLowerCase() === wanted)
      if (index === -1 || event.score.kind !== "team") return []
      const [own, other] = index === 0 ? [event.score.home, event.score.away] : [event.score.away, event.score.home]
      const result: FormResult = own === other ? "draw" : own > other ? "win" : "loss"
      return [{ eventId: event.id, result }]
    })
    .slice(0, limit)
}

/** The rows around a team, so its page shows its place without the whole table. Empty when it is not listed. */
export function tableAround<T extends { team: string }>(rows: T[], team: string, radius = 2): T[] {
  const wanted = team.toLowerCase()
  const index = rows.findIndex((row) => row.team.toLowerCase() === wanted)
  if (index === -1) return []
  const start = Math.max(0, Math.min(index - radius, rows.length - radius * 2 - 1))
  return rows.slice(start, start + radius * 2 + 1)
}
