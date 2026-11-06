import Link from "next/link"
import { SportIcon } from "@/components/site/sport-icon"
import type { Dictionary } from "@/lib/i18n"
import type { CompetitionGroup } from "@/lib/sports/priority"
import { EventCard } from "./event-card"

export function CompetitionGroupSection({ group, total, t, href }: { group: CompetitionGroup; total: number; t: Dictionary; href: (path: string) => string }) {
  const { competition, events } = group
  const first = events[0]
  const standings = competition.id && first.participantType === "team" && /^\d{1,8}$/.test(competition.id)
  return (
    <section aria-label={competition.name}>
      <header className="mb-2.5 flex items-center gap-2">
        <SportIcon id={first.sportId} className="size-4 shrink-0 text-ink-3" />
        <h2 className="min-w-0 truncate text-sm font-semibold text-ink">
          {standings ? <Link href={href(`/app/standings/${competition.id}`)} className="underline-offset-2 hover:underline">{competition.name}</Link> : competition.name}
        </h2>
        {competition.country && <span className="hidden min-w-0 truncate text-xs text-ink-3 sm:inline">{competition.country}</span>}
        <span className="tabular ml-auto shrink-0 text-xs text-ink-3">{t.scores.games.replace("{count}", String(total))}</span>
      </header>
      <div className="fs-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
      </div>
    </section>
  )
}
