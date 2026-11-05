import Link from "next/link"
import { notFound } from "next/navigation"
import { MatchCommunity } from "@/components/community/match-community"
import { StatusLabel } from "@/components/sports/event-card"
import { EventResult } from "@/components/sports/event-result"
import { ExportButton } from "@/components/sports/export-button"
import { FavoriteStar, LocalTime, MatchScore } from "@/components/sports/parts"
import { supportsScorePrediction } from "@/lib/community/predictions"
import { pageContext } from "@/lib/page-context"
import { eventTitle, isDuel } from "@/lib/sports/presentation"
import { getEvent } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"
import { evaluateViewing } from "@/lib/video/viewing"

export default async function MatchPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const { locale, t, href } = await pageContext(params)

  let event: SportEvent | null = null
  let failed = false
  try {
    event = await getEvent(id)
  } catch {
    failed = true
  }
  if (!event && !failed) notFound()

  const back = <Link href={href("/app/scores")} className="text-sm font-semibold text-hot-text hover:underline">{t.match.back}</Link>

  if (!event) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {back}
        <p role="alert" className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm text-bad">{t.feed.unavailable}</p>
      </main>
    )
  }

  const duel = isDuel(event)
  const [home, away] = event.participants
  const title = eventTitle(event)
  const startLabel = event.participantType === "team" && event.sportId !== "cricket" ? t.match.kickoff : t.event.start
  const start = event.scheduledStartUTC
  const viewing = evaluateViewing([], { country: null, platform: "web", entitled: false, now: new Date() })

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {back}
      <section aria-label={t.match.viewing} className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">{t.match.viewing}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-2">{t.match.noVideo}</p>
        {viewing.options.some((option) => option.action === "follow_live") && <p className="mt-3 text-sm font-semibold text-ink">{t.match.followLive}</p>}
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-2">{event.competition.name}</p>
          <StatusLabel status={event.status} t={t} />
        </div>
        {event.participantType !== "team" && <p className="mt-4 text-sm text-ink-3">{t.event.types[event.eventType]}</p>}
        {duel && event.eventName && <p className="mt-1 font-semibold text-ink-2">{event.eventName}</p>}
        <h1 className={`${event.participantType === "team" ? "mt-4" : "mt-1"} text-2xl font-bold text-ink`}>{title}</h1>
        {duel && (
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="flex items-center gap-1 font-semibold text-ink"><FavoriteStar team={home.name} />{home.name}</p>
            <div className="text-center">
              {event.score.kind === "team" && <MatchScore home={event.score.home} away={event.score.away} label={title} />}
              {event.score.kind === "none" && <span className="text-sm font-medium text-ink-3">{event.participantType === "team" ? t.match.noScore : t.event.noResult}</span>}
            </div>
            <p className="flex items-center justify-end gap-1 text-right font-semibold text-ink">{away.name}<FavoriteStar team={away.name} /></p>
          </div>
        )}
        {!duel && event.score.kind === "none" && <p className="mt-3 text-sm text-ink-3">{t.event.noParticipants}</p>}
        <EventResult event={event} t={t} />
        <dl className="mt-6 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-3">{startLabel}</dt>
            <dd className="text-ink">
              {start && !event.dateOnly && <LocalTime iso={start} mode="datetime" />}
              {start && event.dateOnly && `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(start))}. ${t.match.tbd}`}
              {!start && t.match.tbd}
            </dd>
          </div>
          {event.venue && <div><dt className="text-ink-3">{t.match.venue}</dt><dd className="text-ink">{event.venue}</dd></div>}
        </dl>
        <ExportButton matchId={event.id} />
      </section>

      {process.env.COMMUNITY_ENABLED === "true" && (
        <MatchCommunity
          matchId={event.id}
          predictable={supportsScorePrediction(event) && event.status === "scheduled" && Boolean(event.scheduledStartUTC) && Date.now() < Date.parse(event.scheduledStartUTC as string)}
          home={duel ? home.name : title}
          away={duel ? away.name : title}
        />
      )}
    </main>
  )
}
