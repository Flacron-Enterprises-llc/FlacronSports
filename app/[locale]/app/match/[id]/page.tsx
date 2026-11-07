import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, MapPin, Table2, Trophy } from "lucide-react"
import { MatchCommunity } from "@/components/community/match-community"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, Notice, Panel } from "@/components/site/states"
import { EventResult } from "@/components/sports/event-result"
import { EventActions } from "@/components/sports/event-actions"
import { ExportButton } from "@/components/sports/export-button"
import { ShareCardButton } from "@/components/sports/share-card-button"
import { EntrantsTab, LineupsTab, LiveUpdatesTab, MatchDetailProvider, StatisticsTab } from "@/components/sports/match-detail"
import { MatchPlayer, MatchTabs, ViewingPanel, ViewingProvider } from "@/components/sports/match-center"
import { MatchForm, MatchFormSkeleton } from "@/components/sports/match-form"
import { MatchHero } from "@/components/sports/match-hero"
import { PeriodScore } from "@/components/sports/period-score"
import { CardParticipants, hasSportStatistics, RankedPlayers, SportFacts, SportStatistics, SportUpdates, WeekendSessions } from "@/components/sports/sport-sections"
import { LiveRefresh, LocalTime, SpoilerScope } from "@/components/sports/parts"
import { predictionKind, predictionOpen } from "@/lib/community/predictions"
import { getDictionary, isLocale } from "@/lib/i18n"
import { MemberAccessRequired } from "@/lib/member-fetch"
import { pageContext } from "@/lib/page-context"
import { lineScore } from "@/lib/sports/adapters/line-score"
import { isStaleUpdate } from "@/lib/sports/detail"
import { eventTitle, hasResult, isDuel } from "@/lib/sports/presentation"
import { getEvent, getRaceSchedule } from "@/lib/sports/service"
import { RACE_SERIES, sessionStatus } from "@/lib/sports/seasons"
import { sportSteps } from "@/lib/sports/sport-terms"
import type { SportEvent, SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return { title: getDictionary(isLocale(locale) ? locale : "en").ui.matchCenter }
}

// Only these sports kick off. The rest simply start.
const KICKOFF_SPORTS = new Set<SportId>(["football", "american-football", "rugby"])

export default async function MatchPage({ params }: Props) {
  const { id } = await params
  const { locale, t, href } = await pageContext(params)

  let event: SportEvent | null = null
  let failed = false
  try {
    event = await getEvent(id)
  } catch (error) {
    if (error instanceof MemberAccessRequired) return <MemberDataPending />
    failed = true
  }
  if (!event && !failed) notFound()

  const back = (
    <Link href={href("/app/scores")} className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-hot-text hover:underline">
      <ArrowLeft aria-hidden className="size-4" /> {t.match.back}
    </Link>
  )

  if (!event) {
    return (
      <AppPage width="xl">
        {back}
        <div className="mt-5"><ErrorNotice>{t.feed.unavailable}</ErrorNotice></div>
      </AppPage>
    )
  }

  const duel = isDuel(event)
  const title = eventTitle(event)
  const startLabel = KICKOFF_SPORTS.has(event.sportId) ? t.match.kickoff : t.event.start
  const start = event.scheduledStartUTC
  const community = process.env.COMMUNITY_ENABLED === "true"
  const pickKind = predictionKind(event)
  const hasResultPanel = event.score.kind !== "none" && event.score.kind !== "team"
  const lineTable = lineScore(event, t)
  const teamDuel = duel && event.participantType === "team"
  const stale = isStaleUpdate(event.status, event.sourceUpdatedAt, Date.now())
  const [home, away] = event.participants
  const sideNames = { home: home?.name ?? "", away: away?.name ?? "" }
  const { details } = event
  const weekend = details?.kind === "motorsport" && details.round && RACE_SERIES.some((series) => series.id === event?.competition.id)
    ? (await getRaceSchedule(event.competition.id as string).catch(() => null))?.items.find((item) => item.round === details.round)
    : undefined
  const roster = details?.kind === "combat" && details.bouts.length > 1
    ? <CardParticipants details={details} t={t} />
    : details?.kind === "tennis" && details.ranks.some((rank) => rank !== null) ? <RankedPlayers event={event} t={t} /> : null

  const facts = [
    {
      label: startLabel,
      icon: <CalendarClock aria-hidden />,
      value: (
        <>
          {start && !event.dateOnly && <LocalTime iso={start} mode="datetime" />}
          {start && event.dateOnly && `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(start))}. ${t.match.tbd}`}
          {!start && t.match.tbd}
        </>
      ),
    },
    { label: t.match.competition, icon: <Trophy aria-hidden />, value: event.competition.name },
    ...(event.venue ? [{ label: t.match.venue, icon: <MapPin aria-hidden />, value: event.venue }] : []),
  ]

  const overview = (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {hasResultPanel && <Panel><EventResult event={event} t={t} /></Panel>}
        {lineTable && <Panel title={lineTable.caption} icon={<Table2 aria-hidden />}><PeriodScore event={event} t={t} /></Panel>}
        {teamDuel && <Suspense fallback={<MatchFormSkeleton />}><MatchForm event={event} t={t} /></Suspense>}
        <ViewingPanel />
        {!duel && event.score.kind === "none" && <p className="text-sm text-ink-2">{t.event.noParticipants}</p>}
      </div>
      <aside aria-label={t.sportTerms.facts} className="min-w-0 space-y-4">
        <SportFacts event={event} t={t} lead={facts} />
        {weekend && <WeekendSessions sessions={weekend.sessions.map((session) => ({ ...session, status: sessionStatus(session, new Date()) }))} currentId={event.id} t={t} href={href} />}
        <Panel>
          <div className="flex flex-wrap items-center gap-2">
            <EventActions event={event} />
            <ExportButton matchId={event.id} />
            <ShareCardButton matchId={event.id} hasResult={hasResult(event)} />
          </div>
        </Panel>
      </aside>
    </div>
  )

  return (
    <AppPage width="xl">
      <LiveRefresh live={event.status === "live"} />
      {back}

      <ViewingProvider matchId={event.id}>
      <SpoilerScope>
      <div className="mt-3">
        <MatchHero event={event} t={t} locale={locale} title={title} duel={duel} updated={event.sourceUpdatedAt ? <>{t.match.lastUpdate}: <LocalTime iso={event.sourceUpdatedAt} mode="datetime" /></> : undefined} />
      </div>
      {stale && <Notice tone="warning" role="status" className="mt-3">{t.match.stale}</Notice>}
      <MatchPlayer title={event.eventName || event.participants.map((participant) => participant.name).join(" vs ")} />

      <div className="fs-rise mt-3" style={{ ["--i" as string]: 1 }}>
        <MatchDetailProvider matchId={event.id} live={event.status === "live"}>
          <MatchTabs
            overview={overview}
            updates={<LiveUpdatesTab sportId={event.sportId} extra={sportSteps(event, t).length > 0 ? <SportUpdates event={event} t={t} /> : undefined} />}
            statistics={<StatisticsTab {...sideNames} event={event} extra={hasSportStatistics(event) ? <SportStatistics event={event} t={t} /> : undefined} />}
            participants={teamDuel ? <LineupsTab {...sideNames} sportId={event.sportId} /> : roster ?? <EntrantsTab event={{ participants: event.participants, score: event.score }} />}
            chat={community ? (
              <MatchCommunity
                matchId={event.id}
                predictable={Boolean(pickKind) && predictionOpen(event, new Date())}
                kind={pickKind}
                combat={event.sportId === "combat-sports"}
                home={duel ? home.name : title}
                away={duel ? away.name : title}
              />
            ) : undefined}
          />
        </MatchDetailProvider>
      </div>
      </SpoilerScope>
      </ViewingProvider>
    </AppPage>
  )
}
