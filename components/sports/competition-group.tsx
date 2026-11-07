import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { SportIcon } from "@/components/site/sport-icon"
import type { Dictionary } from "@/lib/i18n"
import type { CompetitionGroup } from "@/lib/sports/priority"
import { FollowLeagueButton } from "./event-actions"
import { EventCard, leaguePath } from "./event-card"

// The source files a continental competition under one country.
const CONTINENTAL = /^(?:UEFA|CAF|AFC|FIFA|CONCACAF|CONMEBOL|OFC)\b/

export function CompetitionGroupSection({ group, total, t, href }: { group: CompetitionGroup; total: number; t: Dictionary; href: (path: string) => string }) {
  const { competition, events } = group
  const first = events[0]
  const standings = competition.id && first.participantType === "team" && /^\d{1,8}$/.test(competition.id) ? `/app/standings/${competition.id}` : null
  const league = leaguePath(first)
  const other = league && league !== standings ? league : null
  const main = standings ?? other
  return (
    <section aria-label={competition.name} className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]">
      <header className="fs-foot flex min-h-11 items-center gap-2 border-b border-line px-3 py-1 sm:px-4">
        <SportIcon id={first.sportId} className="size-4 shrink-0 text-brand" />
        <h2 className="min-w-0 truncate text-sm font-semibold text-ink">
          {main ? <Link href={href(main)} className="underline-offset-2 hover:underline">{competition.name}</Link> : competition.name}
        </h2>
        {competition.country && !CONTINENTAL.test(competition.name) && <span className="hidden min-w-0 truncate text-xs text-ink-2 sm:inline">{competition.country}</span>}
        <span className="tabular ml-auto shrink-0 text-xs text-ink-2">{(total === 1 ? t.scores.oneGame : t.scores.games).replace("{count}", String(total))}</span>
        {other && standings && (
          <Link href={href(other)} aria-label={`${t.scores.competition}: ${competition.name}`} title={t.scores.competition} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-muted hover:text-ink sm:size-8"><ArrowUpRight aria-hidden className="size-4" /></Link>
        )}
        {competition.id && <FollowLeagueButton league={{ id: competition.id, name: competition.name, sportId: first.sportId }} />}
      </header>
      <div className="fs-rows fs-rows-2 fs-settle">
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} layout="row" />)}
      </div>
    </section>
  )
}
