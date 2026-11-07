import { Check } from "lucide-react"
import { SportIcon } from "@/components/site/sport-icon"
import type { Dictionary, Locale } from "@/lib/i18n"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { inningsLine, liveClock, livePhase, setsWon } from "@/lib/sports/presentation"
import { currentPeriod } from "@/lib/sports/thesportsdb"
import type { Participant, SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { nameOf, StatusLabel } from "./event-card"
import { ResultNote } from "./event-result"
import { Crest, FavoriteStar, LocalTime, MatchScore, SpoilerGuard, SpoilerReveal, SpoilerText } from "./parts"

interface Segment {
  key: string
  label: string
  home: number | string | null
  away: number | string | null
}

/** Each period in hero order, home then away, whatever order the sport's own table reads in. */
function segments(event: SportEvent, t: Dictionary): Segment[] {
  if (event.score.kind === "sets" && !event.breakdown) {
    const { lines } = event.score
    const [home, away] = event.participants.map((side) => lines.find((line) => line.name === side.name)?.games ?? [])
    return (home ?? []).map((games, index) => ({ key: `set-${index}`, label: t.event.set.replace("{n}", String(index + 1)), home: games, away: away?.[index] ?? null }))
  }
  const table = lineScore(event, t, "short")
  if (!table) return []
  const home = table.rows.find((row) => row.side === "home")
  const away = table.rows.find((row) => row.side === "away")
  return table.columns.flatMap((column, index) => (column.total ? [] : [{ key: column.key, label: column.label, home: home?.cells[index]?.value ?? null, away: away?.cells[index]?.value ?? null }]))
}

function Segments({ items, t }: { items: Segment[]; t: Dictionary }) {
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
      {items.map((item) => (
        <li key={item.key} className="fs-seg flex min-w-[3.25rem] flex-col items-center rounded-lg px-2 py-1">
          <span className="text-[11px] font-medium leading-4 text-white/70">{item.label}</span>
          <span className="tabular whitespace-nowrap text-[13px] font-semibold leading-5 text-white">
            {item.home ?? "–"}<span aria-hidden className="mx-0.5 text-white/40">-</span>{item.away ?? "–"}
            {(item.home === null || item.away === null) && <span className="sr-only"> {t.match.notAvailable}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Side({ side, event, t, line }: { side: Participant; event: SportEvent; t: Dictionary; line?: string }) {
  const { score } = event
  const winner = (score.kind === "sets" || score.kind === "innings" || score.kind === "combat") && score.winner === side.name
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:gap-2">
      <Crest name={side.name} url={side.badgeUrl} size="lg" band />
      <p className="flex min-w-0 max-w-full items-center justify-center gap-1 text-sm font-semibold leading-5 text-white sm:text-[17px] sm:leading-6">
        <span className="min-w-0 break-words">{nameOf(side.name, t)}</span>
        {winner && <SpoilerText><Check aria-hidden className="size-4 shrink-0 text-[#ff8a55]" /></SpoilerText>}
      </p>
      {line && <SpoilerGuard label={t.spoiler.revealResult} quiet><p className="fs-score text-lg font-semibold text-white sm:text-2xl">{line}</p></SpoilerGuard>}
      <span className="text-white [&_button]:text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white"><FavoriteStar team={side.name} /></span>
    </div>
  )
}

function StartTime({ event, t, locale }: { event: SportEvent; t: Dictionary; locale: Locale }) {
  const start = event.scheduledStartUTC
  if (!start) return <span className="block text-sm font-medium text-white/80">{t.match.tbd}</span>
  if (event.dateOnly) {
    return (
      <span className="block">
        <span className="block text-base font-semibold text-white sm:text-lg">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(start))}</span>
        <span className="mt-1 block text-xs text-white/70">{t.match.tbd}</span>
      </span>
    )
  }
  return (
    <span className="block">
      <span className="fs-score block text-[1.75rem] font-semibold text-white sm:text-[2.5rem]"><LocalTime iso={start} /></span>
      <span className="mt-1.5 block text-xs font-medium text-white/70 [&_time]:font-medium"><LocalTime iso={start} mode="datetime" /></span>
    </span>
  )
}

/** The middle of the scoreboard: the score where one number states it, the start time before it begins. */
function Centre({ event, t, locale, title }: { event: SportEvent; t: Dictionary; locale: Locale; title: string }) {
  const { score } = event
  const sets = setsWon(event)
  if (score.kind === "team") return <MatchScore home={score.home} away={score.away} label={title} />
  if (sets) return <MatchScore home={sets[0]} away={sets[1]} label={title} />
  if (score.kind === "none" && event.status === "scheduled") return <StartTime event={event} t={t} locale={locale} />
  if (score.kind === "none") return <span className="block max-w-24 text-xs font-medium text-white/75 sm:max-w-32 sm:text-sm">{event.participantType === "team" ? t.match.noScore : t.event.noResult}</span>
  return <span aria-hidden className="fs-score text-2xl font-semibold text-white/40">–</span>
}

/** A race has no two sides: the top three stand in for the score, and they are the result. */
function Podium({ event, t }: { event: SportEvent; t: Dictionary }) {
  if (event.score.kind !== "classification" || event.score.entries.length === 0) return null
  return (
    <div className="mt-5">
      <SpoilerReveal label={t.spoiler.revealResult} />
      <SpoilerGuard label={t.spoiler.revealResult} quiet>
        <ol aria-label={t.event.podium} className="grid gap-2 sm:grid-cols-3">
          {event.score.entries.slice(0, 3).map((entry) => (
            <li key={entry.position} className={cn("fs-seg flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5", entry.position === 1 && "border-[#ff8a55]/50")}>
              <span className="fs-score shrink-0 text-2xl font-bold text-white">{entry.position}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{entry.name}</span>
                {(entry.team || entry.time) && <span className="tabular block truncate text-xs text-white/70">{entry.time ?? entry.team}</span>}
              </span>
            </li>
          ))}
        </ol>
      </SpoilerGuard>
    </div>
  )
}

/** Live position in the sport's own words. Sports without short phases still get their long name. */
function livePosition(event: SportEvent, t: Dictionary): string | null {
  const short = livePhase(event, t)
  const clock = liveClock(event, short)
  if (event.status !== "live") return null
  const long = short ? null : currentPeriod(event.providerStatus, event.sportId, event.competition.name)
  const phase = short ?? (long ? t.match.periods[long.key].replace("{n}", String(long.number ?? "")) : null)
  return [phase, clock].filter(Boolean).join(" ") || null
}

export function MatchHero({ event, t, locale, title, duel, updated }: { event: SportEvent; t: Dictionary; locale: Locale; title: string; duel: boolean; updated?: React.ReactNode }) {
  const { score } = event
  const [home, away] = event.participants
  const live = event.status === "live"
  const position = livePosition(event, t)
  const items = duel && score.kind !== "none" ? segments(event, t) : []
  const lines = score.kind === "innings" ? [inningsLine(score.homeInnings, score.home), inningsLine(score.awayInnings, score.away)] : [undefined, undefined]
  const noted = score.kind === "sets" || score.kind === "innings" || score.kind === "combat"
  const needsReveal = duel && score.kind !== "team" && score.kind !== "none" && !setsWon(event)

  return (
    <section aria-label={title} className={cn("fs-band fs-rise relative overflow-hidden rounded-2xl px-4 pb-4 pt-4 sm:px-7 sm:pb-5 sm:pt-5", live && "fs-hero-live")}>
      <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-white/85">
            <SportIcon id={event.sportId} className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{event.competition.name}</span>
          </p>
          <span className="flex shrink-0 items-center gap-2">
            {position && <span className="tabular text-[13px] font-semibold text-white">{position}</span>}
            <span className="rounded-full bg-white/95 dark:bg-surface"><StatusLabel status={event.status} conclusion={event.conclusion} t={t} event={event} /></span>
          </span>
        </div>

        {event.participantType !== "team" && <p className="mt-3 text-[13px] text-white/75">{t.event.types[event.eventType]}</p>}
        {duel && event.eventName && <p className={cn("font-semibold text-white/90", event.participantType === "team" ? "mt-3" : "mt-0.5")}>{event.eventName}</p>}
        <h1 className={duel ? "sr-only" : "mt-1 text-2xl font-semibold text-white sm:text-[1.875rem]"}>{title}</h1>

        {duel && (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
            <Side side={home} event={event} t={t} line={lines[0]} />
            <div className="text-center"><Centre event={event} t={t} locale={locale} title={title} /></div>
            <Side side={away} event={event} t={t} line={lines[1]} />
          </div>
        )}

        {needsReveal && <div className="mt-3 text-center empty:hidden [&_button]:bg-white/10 [&_button]:text-white"><SpoilerReveal label={t.spoiler.revealResult} /></div>}
        {noted && <div className="mt-3 text-center empty:hidden [&_p]:text-white/90"><ResultNote event={event} t={t} quiet /></div>}
        {items.length > 0 && <SpoilerGuard label={t.spoiler.revealResult} quiet><Segments items={items} t={t} /></SpoilerGuard>}
        {event.shootout && (
          <SpoilerGuard label={t.spoiler.revealResult} quiet>
            <p className="tabular mt-3 text-center text-sm font-semibold text-white/90">{t.match.shootoutScore.replace("{home}", String(event.shootout.home)).replace("{away}", String(event.shootout.away))}</p>
          </SpoilerGuard>
        )}
        {event.aggregate && (
          <SpoilerGuard label={t.spoiler.revealResult} quiet>
            <p className="tabular mt-3 text-center text-sm font-semibold text-white/90">{t.match.aggregateScore.replace("{home}", String(event.aggregate.home)).replace("{away}", String(event.aggregate.away))}</p>
          </SpoilerGuard>
        )}
        <div className="[&_button]:bg-white/10 [&_button]:text-white"><Podium event={event} t={t} /></div>
        {updated && <p className="mt-4 text-center text-xs text-white/65 sm:text-right [&_time]:font-normal">{updated}</p>}
      </div>
    </section>
  )
}
