import Link from "next/link"
import type { Dictionary } from "@/lib/i18n"
import type { EventFeed, EventStatus, SportEvent } from "@/lib/sports/types"
import { FavoriteStar, LocalTime, ScoreValue } from "./parts"

const TONE: Record<EventStatus, string> = {
  live: "text-live",
  finished: "text-ink-2",
  scheduled: "text-ink-2",
  postponed: "text-warn",
  canceled: "text-bad",
  interrupted: "text-warn",
  abandoned: "text-bad",
  unknown: "text-ink-3",
}

export function StatusLabel({ status, t }: { status: EventStatus; t: Dictionary }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TONE[status]}`}>
      {status === "live" && <span aria-hidden className="fs-live-dot size-2 rounded-full bg-live" />}
      {t.status[status]}
    </span>
  )
}

export function EventCard({ event, t, href }: { event: SportEvent; t: Dictionary; href: (path: string) => string }) {
  const [home, away] = event.participants
  const score = event.score.kind === "team" ? event.score : null

  return (
    <article className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-ink-3">{event.competition.name}</p>
        <StatusLabel status={event.status} t={t} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {[{ team: home, value: score?.home }, { team: away, value: score?.away }].map(({ team, value }) => (
          <li key={team.role} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <FavoriteStar team={team.name} />
              <span className="truncate font-medium text-ink">{team.name}</span>
            </span>
            <ScoreValue value={value} label={team.name} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-2">
        {event.scheduledStartUTC ? <LocalTime iso={event.scheduledStartUTC} /> : <span>{t.match.tbd}</span>}
        <Link href={href(`/match/${event.id}`)} className="font-semibold text-hot-text underline-offset-2 hover:underline">
          {t.match.overview}<span className="sr-only">: {home.name} / {away.name}</span>
        </Link>
      </div>
    </article>
  )
}

export function FeedNotice({ feed, t }: { feed: EventFeed; t: Dictionary }) {
  return (
    <div className="space-y-2">
      {feed.state === "unavailable" && <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-bad">{t.feed.unavailable}</p>}
      {feed.state === "stale" && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-warn">{t.feed.stale}</p>}
      {feed.limited && feed.state !== "unavailable" && <p className="text-xs leading-5 text-ink-3">{t.feed.limited}</p>}
      <p className="text-xs text-ink-3">{t.feed.source}: {feed.source} · {t.feed.updated}: <LocalTime iso={feed.fetchedAt} /></p>
    </div>
  )
}
