import { canHaveTable } from "@/lib/sports/calculated"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { SportIcon } from "@/components/site/sport-icon"
import { Notice } from "@/components/site/states"
import type { Dictionary } from "@/lib/i18n"
import { LEAGUE_COLLECTED } from "@/lib/sports/collect"
import { eventTitle, hasResult, isDuel, liveClock, livePhase, rowValues } from "@/lib/sports/presentation"
import { sportChip } from "@/lib/sports/sport-terms"
import type { EventConclusion, EventFeed, EventStatus, SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { EventActions } from "./event-actions"
import { Classification, ResultNote } from "./event-result"
import { Crest, FavoriteStar, LocalTime, ScoreValue, SpoilerReveal, SpoilerScope, SpoilerText } from "./parts"
import { PeriodScore } from "./period-score"

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

const PLAIN_TONE: Record<EventStatus, string> = {
  live: "text-live",
  finished: "text-ink-2",
  scheduled: "text-ink-2",
  postponed: "text-warn",
  canceled: "text-live",
  interrupted: "text-warn",
  abandoned: "text-live",
  unknown: "text-ink-2",
}

/** `plain` drops the pill, for the narrow time column of a match row. */
export function StatusLabel({ status, conclusion, t, plain }: { status: EventStatus; conclusion?: EventConclusion; t: Dictionary; plain?: boolean }) {
  return (
    <span className={plain ? cn("inline-flex items-center gap-1.5 text-[11.5px] font-semibold leading-4", PLAIN_TONE[status]) : cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border-transparent px-2 py-0.5 text-[11.5px] font-semibold", TONE[status])}>
      {status === "live" && <span aria-hidden className="fs-live-dot size-1.5 shrink-0 rounded-full bg-live" />}
      <span>
        {t.status[status]}
        {conclusion && status === "finished" && <SpoilerText> · {t.status.conclusions[conclusion]}</SpoilerText>}
      </span>
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

/** The league's table, official or calculated, or its own page where it has no table. */
export function leaguePath(event: SportEvent): string | null {
  const { id } = event.competition
  if (!id || !/^\d{1,8}$/.test(id)) return null
  if (LEAGUE_COLLECTED.has(event.sportId)) return `/app/league/${id}`
  const table = event.participantType === "team" && (event.sportId === "football" || canHaveTable(event.sportId, event.competition.name))
  return table ? `/app/standings/${id}` : null
}

/** What every sport shows between the header and the footer. The sport decides which lines exist. */
function EventLines({ event, t, href }: { event: SportEvent; t: Dictionary; href: (path: string) => string }) {
  const { score } = event
  const teams = event.participantType === "team"
  const values = rowValues(event)
  const caption = score.kind === "sets" ? t.event.sets : score.kind === "innings" ? t.event.innings : null
  const chip = sportChip(event, t)
  const entrants = !isDuel(event) && score.kind !== "classification" ? event.participants : []
  return (
    <>
      {(chip || !teams) && <p className="truncate text-xs leading-5 text-ink-2">{chip ?? t.event.types[event.eventType]}</p>}
      {event.eventName && <p className="truncate text-sm font-semibold leading-5 text-ink">{event.eventName}</p>}
      {isDuel(event) && (
        <ul aria-label={caption ?? undefined} className="space-y-0.5">
          {event.participants.map((participant, index) => (
            <li key={participant.name} className="flex min-h-8 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Crest name={participant.name} url={participant.badgeUrl} />
                {!teams || participant.name === "TBD" ? (
                  <span className="min-w-0 truncate text-sm font-medium text-ink">{nameOf(participant.name, t)}</span>
                ) : (
                  <Link href={href(`/app/team/${encodeURIComponent(participant.name)}?sport=${event.sportId}`)} className="min-w-0 truncate text-sm font-medium text-ink underline-offset-2 hover:underline">{participant.name}</Link>
                )}
                <FavoriteStar team={participant.name} />
              </span>
              <ScoreValue value={values[index]} label={participant.name} dim={dimmed(values, index, event.status === "finished")} />
            </li>
          ))}
        </ul>
      )}
      {entrants.length > 0 && (
        <ul className="space-y-0.5">
          {entrants.slice(0, 4).map((participant) => (
            <li key={participant.name} className="flex min-h-7 items-center gap-1 text-sm font-medium text-ink">
              <span className="min-w-0 truncate">{participant.name}</span>
              <FavoriteStar team={participant.name} />
            </li>
          ))}
        </ul>
      )}
      {score.kind === "classification" && <div className="mt-1.5"><Classification entries={score.entries} t={t} limit={3} quiet /></div>}
      {score.kind !== "team" && score.kind !== "none" && score.kind !== "classification" && <div className="mt-1"><ResultNote event={event} t={t} quiet /></div>}
      {event.breakdown && <div className="mt-1"><PeriodScore event={event} t={t} compact /></div>}
      {hasResult(event) && <div className="mt-1.5 empty:hidden"><SpoilerReveal label={t.spoiler.revealResult} /></div>}
    </>
  )
}

function OverviewLink({ event, t, href, className }: { event: SportEvent; t: Dictionary; href: (path: string) => string; className?: string }) {
  return (
    <Link href={href(`/app/match/${event.id}`)} className={cn("inline-flex items-center gap-1 text-xs font-semibold text-hot-text underline-offset-2 hover:underline", className)}>
      {t.match.overview}<span className="sr-only">: {eventTitle(event)}</span>
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  )
}

// A game with a date and no time is only "to be confirmed" while it is still to come.
const startText = (event: SportEvent, t: Dictionary, mode: "time" | "datetime") => {
  if (!event.scheduledStartUTC) return <span>{t.match.tbd}</span>
  if (!event.dateOnly) return <LocalTime iso={event.scheduledStartUTC} mode={mode} />
  return event.status === "scheduled" ? <span>{t.match.tbd}</span> : <LocalTime iso={event.scheduledStartUTC} mode="date" />
}

/**
 * `row` is the dense form used inside a competition group: time on the left, the sides in
 * the middle and the actions on the right. `card` stands alone, so it names the competition.
 */
export function EventCard({ event, t, href, timeMode = "time", layout = "card", showCompetition }: { event: SportEvent; t: Dictionary; href: (path: string) => string; timeMode?: "time" | "datetime"; layout?: "card" | "row"; showCompetition?: boolean }) {
  const phase = livePhase(event, t)
  const clock = liveClock(event, phase)
  const live = event.status === "live"

  if (layout === "row") {
    const upcoming = event.status === "scheduled"
    return (
      <article className={cn("fs-row grid grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-x-2.5 px-3 py-2 sm:grid-cols-[4.75rem_minmax(0,1fr)_auto] sm:gap-x-3 sm:px-4", live && "fs-row-live")}>
        <SpoilerScope>
          <div className="min-w-0 pt-1.5">
            {!upcoming && <StatusLabel status={event.status} conclusion={event.conclusion} t={t} plain />}
            {upcoming && <span className="sr-only">{t.status.scheduled}</span>}
            {(phase || clock) && <p className="tabular text-[11.5px] font-semibold leading-4 text-ink-2">{[phase, clock].filter(Boolean).join(" ")}</p>}
            {!live && <p className={cn("tabular", upcoming ? "text-[13px] font-semibold leading-5 text-ink" : "text-[11.5px] leading-4 text-ink-2")}>{startText(event, t, "time")}</p>}
            <OverviewLink event={event} t={t} href={href} className="-mb-1 min-h-10 sm:mb-0 sm:mt-0.5 sm:min-h-5" />
          </div>
          <div className="min-w-0 self-center">
            {showCompetition && <p className="flex min-w-0 items-center gap-1.5 truncate text-xs leading-5 text-ink-2"><SportIcon id={event.sportId} className="size-3.5 shrink-0" /><span className="min-w-0 truncate">{event.competition.name}</span></p>}
            <EventLines event={event} t={t} href={href} />
          </div>
          <div className="-mr-2 flex flex-col items-center justify-center sm:mr-[-0.25rem]"><EventActions event={event} /></div>
        </SpoilerScope>
      </article>
    )
  }

  const leaguePage = leaguePath(event)
  return (
    <article className={cn("fs-lift flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]", live && "fs-card-live")}>
      <SpoilerScope>
        <div className="flex-1 px-3.5 pb-2.5 pt-3">
          <div className="mb-1.5 flex min-h-6 items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-2">
              <SportIcon id={event.sportId} className="size-3.5 shrink-0" />
              {leaguePage ? (
                <Link href={href(leaguePage)} className="min-w-0 truncate underline-offset-2 hover:text-ink hover:underline">{event.competition.name}</Link>
              ) : (
                <span className="min-w-0 truncate">{event.competition.name}</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {phase && <span className="tabular text-xs font-semibold text-ink-2">{phase}</span>}
              {clock && <span className="tabular text-xs font-semibold text-ink-2">{clock}</span>}
              <StatusLabel status={event.status} conclusion={event.conclusion} t={t} />
            </span>
          </div>
          <EventLines event={event} t={t} href={href} />
        </div>
        <div className="fs-foot flex items-center justify-between gap-2 px-3.5 py-0.5 text-xs text-ink-2">
          <span className="flex min-w-0 items-center gap-1">
            <span className="tabular min-w-0">{startText(event, t, timeMode)}</span>
            <EventActions event={event} />
          </span>
          <OverviewLink event={event} t={t} href={href} className="min-h-10 shrink-0 sm:min-h-8" />
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
      <p className="text-xs text-ink-2">{t.feed.updated}: <LocalTime iso={feed.fetchedAt} /></p>
    </div>
  )
}
