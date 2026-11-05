import Link from "next/link"
import type { Dictionary } from "@/lib/i18n"
import { eventTitle, isDuel, rowValues } from "@/lib/sports/presentation"
import type { EventFeed, EventStatus, SportEvent } from "@/lib/sports/types"
import { Classification, ResultNote } from "./event-result"
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

export function EventCard({ event, t, href, timeMode = "time" }: { event: SportEvent; t: Dictionary; href: (path: string) => string; timeMode?: "time" | "datetime" }) {
  const { score } = event
  const teams = event.participantType === "team"
  const values = rowValues(event)
  const caption = score.kind === "sets" ? t.event.sets : score.kind === "innings" ? t.event.innings : null

  return (
    <article className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3">
        {event.competition.id && teams ? (
          <Link href={href(`/app/standings/${event.competition.id}`)} className="min-w-0 truncate text-xs font-medium text-ink-3 underline-offset-2 hover:text-ink hover:underline">{event.competition.name}</Link>
        ) : (
          <p className="min-w-0 truncate text-xs font-medium text-ink-3">{event.competition.name}</p>
        )}
        <StatusLabel status={event.status} t={t} />
      </div>
      {!teams && <p className="mt-2 text-xs text-ink-3">{t.event.types[event.eventType]}</p>}
      {event.eventName && <p className={`${teams ? "mt-2" : "mt-0.5"} truncate font-semibold text-ink`}>{event.eventName}</p>}
      {isDuel(event) && (
        <ul aria-label={caption ?? undefined} className="mt-3 space-y-1.5">
          {event.participants.map((participant, index) => (
            <li key={participant.name} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1">
                <FavoriteStar team={participant.name} />
                {!teams || participant.name === "TBD" ? (
                  <span className="truncate font-medium text-ink">{participant.name}</span>
                ) : (
                  <Link href={href(`/app/team/${encodeURIComponent(participant.name)}?sport=${event.sportId}`)} className="truncate font-medium text-ink underline-offset-2 hover:underline">{participant.name}</Link>
                )}
              </span>
              <ScoreValue value={values[index]} label={participant.name} />
            </li>
          ))}
        </ul>
      )}
      {score.kind === "classification" && <div className="mt-3"><Classification entries={score.entries} t={t} limit={3} /></div>}
      {score.kind !== "team" && score.kind !== "none" && score.kind !== "classification" && <div className="mt-2"><ResultNote event={event} t={t} /></div>}
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-2">
        {event.scheduledStartUTC && !event.dateOnly ? <LocalTime iso={event.scheduledStartUTC} mode={timeMode} /> : <span>{t.match.tbd}</span>}
        <Link href={href(`/app/match/${event.id}`)} className="font-semibold text-hot-text underline-offset-2 hover:underline">
          {t.match.overview}<span className="sr-only">: {eventTitle(event)}</span>
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
      <p className="text-xs text-ink-3">{t.feed.updated}: <LocalTime iso={feed.fetchedAt} /></p>
    </div>
  )
}
