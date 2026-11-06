import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { SportIcon } from "@/components/site/sport-icon"
import { Notice } from "@/components/site/states"
import type { Dictionary } from "@/lib/i18n"
import { eventTitle, hasResult, isDuel, rowValues } from "@/lib/sports/presentation"
import type { EventFeed, EventStatus, SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { Classification, ResultNote } from "./event-result"
import { Crest, FavoriteStar, LocalTime, ScoreValue, SpoilerReveal, SpoilerScope } from "./parts"

const TONE: Record<EventStatus, string> = {
  live: "fs-chip-live border",
  finished: "bg-surface-muted text-ink-2",
  scheduled: "bg-surface-muted text-ink-2",
  postponed: "fs-chip-warn border",
  canceled: "fs-chip-live border",
  interrupted: "fs-chip-warn border",
  abandoned: "fs-chip-live border",
  unknown: "bg-surface-muted text-ink-2",
}

export function StatusLabel({ status, t }: { status: EventStatus; t: Dictionary }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border-transparent px-2 py-0.5 text-[11.5px] font-semibold", TONE[status])}>
      {status === "live" && <span aria-hidden className="fs-live-dot size-1.5 rounded-full bg-live" />}
      {t.status[status]}
    </span>
  )
}

export const nameOf = (name: string, t: Dictionary) => (name === "TBD" ? t.ui.tbd : name)

/** The lower score reads quieter once a team match is over. */
function dimmed(values: (number | string | undefined)[], index: number, finished: boolean): boolean {
  const [home, away] = values
  if (!finished || typeof home !== "number" || typeof away !== "number" || home === away) return false
  return index === 0 ? home < away : away < home
}

export function EventCard({ event, t, href, timeMode = "time" }: { event: SportEvent; t: Dictionary; href: (path: string) => string; timeMode?: "time" | "datetime" }) {
  const { score } = event
  const teams = event.participantType === "team"
  const values = rowValues(event)
  const caption = score.kind === "sets" ? t.event.sets : score.kind === "innings" ? t.event.innings : null
  const standings = event.competition.id && teams && /^\d{1,8}$/.test(event.competition.id)
  const entrants = !isDuel(event) && score.kind !== "classification" ? event.participants : []

  return (
    <article className={cn("fs-lift flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]", event.status === "live" && "fs-card-live")}>
      <SpoilerScope>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-2">
            <SportIcon id={event.sportId} className="size-3.5 shrink-0" />
            {standings ? (
              <Link href={href(`/app/standings/${event.competition.id}`)} className="min-w-0 truncate underline-offset-2 hover:text-ink hover:underline">{event.competition.name}</Link>
            ) : (
              <span className="min-w-0 truncate">{event.competition.name}</span>
            )}
          </span>
          <StatusLabel status={event.status} t={t} />
        </div>
        {!teams && <p className="mt-2 text-xs text-ink-3">{t.event.types[event.eventType]}</p>}
        {event.eventName && <p className={cn(teams ? "mt-2" : "mt-0.5", "truncate font-semibold text-ink")}>{event.eventName}</p>}
        {isDuel(event) && (
          <ul aria-label={caption ?? undefined} className="mt-3 space-y-1.5">
            {event.participants.map((participant, index) => (
              <li key={participant.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Crest name={participant.name} url={participant.badgeUrl} />
                  {!teams || participant.name === "TBD" ? (
                    <span className="min-w-0 truncate font-medium text-ink">{nameOf(participant.name, t)}</span>
                  ) : (
                    <Link href={href(`/app/team/${encodeURIComponent(participant.name)}?sport=${event.sportId}`)} className="min-w-0 truncate font-medium text-ink underline-offset-2 hover:underline">{participant.name}</Link>
                  )}
                  <FavoriteStar team={participant.name} />
                </span>
                <ScoreValue value={values[index]} label={participant.name} dim={dimmed(values, index, event.status === "finished")} />
              </li>
            ))}
          </ul>
        )}
        {entrants.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {entrants.slice(0, 4).map((participant) => (
              <li key={participant.name} className="flex items-center gap-1 text-sm font-medium text-ink">
                <span className="min-w-0 truncate">{participant.name}</span>
                <FavoriteStar team={participant.name} />
              </li>
            ))}
          </ul>
        )}
        {score.kind === "classification" && <div className="mt-3"><Classification entries={score.entries} t={t} limit={3} quiet /></div>}
        {score.kind !== "team" && score.kind !== "none" && score.kind !== "classification" && <div className="mt-2"><ResultNote event={event} t={t} quiet /></div>}
        {hasResult(event) && <div className="mt-3"><SpoilerReveal label={t.spoiler.revealResult} /></div>}
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-2">
            {event.scheduledStartUTC && !event.dateOnly ? <LocalTime iso={event.scheduledStartUTC} mode={timeMode} /> : <span>{t.match.tbd}</span>}
            <Link href={href(`/app/match/${event.id}`)} className="inline-flex min-h-6 items-center gap-1 font-semibold text-hot-text underline-offset-2 hover:underline">
              {t.match.overview}<span className="sr-only">: {eventTitle(event)}</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      </SpoilerScope>
    </article>
  )
}

export function FeedNotice({ feed, t }: { feed: EventFeed; t: Dictionary }) {
  return (
    <div className="space-y-2">
      {feed.state === "unavailable" && <ErrorNotice>{t.feed.unavailable}</ErrorNotice>}
      {feed.state === "stale" && <Notice tone="warning" role="status">{t.feed.stale}</Notice>}
      {feed.limited && feed.state !== "unavailable" && <p className="text-xs leading-5 text-ink-3">{t.feed.limited}</p>}
      <p className="text-xs text-ink-3">{t.feed.updated}: <LocalTime iso={feed.fetchedAt} /></p>
    </div>
  )
}
