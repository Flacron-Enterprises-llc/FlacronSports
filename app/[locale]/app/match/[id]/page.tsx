import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, MapPin, Timer, Trophy } from "lucide-react"
import { MatchCommunity } from "@/components/community/match-community"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { SportIcon } from "@/components/site/sport-icon"
import { AppPage, Notice, Panel } from "@/components/site/states"
import { nameOf, StatusLabel } from "@/components/sports/event-card"
import { EventResult } from "@/components/sports/event-result"
import { EventActions } from "@/components/sports/event-actions"
import { ExportButton } from "@/components/sports/export-button"
import { ShareCardButton } from "@/components/sports/share-card-button"
import { EntrantsTab, LineupsTab, LiveUpdatesTab, MatchDetailProvider, StatisticsTab } from "@/components/sports/match-detail"
import { MatchPlayer, MatchTabs, ViewingPanel, ViewingProvider } from "@/components/sports/match-center"
import { MatchForm, MatchFormSkeleton } from "@/components/sports/match-form"
import { Crest, FavoriteStar, LiveRefresh, LocalTime, MatchScore, SpoilerGuard, SpoilerScope } from "@/components/sports/parts"
import { predictionKind, predictionOpen } from "@/lib/community/predictions"
import { getDictionary, isLocale, type Dictionary } from "@/lib/i18n"
import { MemberAccessRequired } from "@/lib/member-fetch"
import { pageContext } from "@/lib/page-context"
import { isStaleUpdate } from "@/lib/sports/detail"
import { eventTitle, hasResult, isDuel } from "@/lib/sports/presentation"
import { getEvent } from "@/lib/sports/service"
import { currentPeriod } from "@/lib/sports/thesportsdb"
import type { SportEvent } from "@/lib/sports/types"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return { title: getDictionary(isLocale(locale) ? locale : "en").ui.matchCenter }
}

function periodText(event: SportEvent, t: Dictionary): string | null {
  if (event.status !== "live") return null
  const period = currentPeriod(event.providerStatus)
  return period ? t.match.periods[period.key].replace("{n}", String(period.number ?? "")) : null
}

const clockText = (clock: string) => (/^\d+$/.test(clock) ? `${clock}′` : clock)

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
      <AppPage width="md">
        {back}
        <div className="mt-5"><ErrorNotice>{t.feed.unavailable}</ErrorNotice></div>
      </AppPage>
    )
  }

  const duel = isDuel(event)
  const [home, away] = event.participants
  const title = eventTitle(event)
  const startLabel = event.participantType === "team" && event.sportId !== "cricket" ? t.match.kickoff : t.event.start
  const start = event.scheduledStartUTC
  const community = process.env.COMMUNITY_ENABLED === "true"
  const pickKind = predictionKind(event)
  const hasResultPanel = event.score.kind !== "none" && event.score.kind !== "team"
  const teamDuel = duel && event.participantType === "team"
  const period = periodText(event, t)
  const clock = event.status === "live" && event.clock ? clockText(event.clock) : null
  const stale = isStaleUpdate(event.status, event.sourceUpdatedAt, Date.now())
  const sideNames = { home: home?.name ?? "", away: away?.name ?? "" }

  const overview = (
    <div className="space-y-4">
      <Panel>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-ink-2"><CalendarClock aria-hidden className="size-4" />{startLabel}</dt>
            <dd className="mt-1 font-medium text-ink">
              {start && !event.dateOnly && <LocalTime iso={start} mode="datetime" />}
              {start && event.dateOnly && `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(start))}. ${t.match.tbd}`}
              {!start && t.match.tbd}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-ink-2"><Trophy aria-hidden className="size-4" />{t.match.competition}</dt>
            <dd className="mt-1 font-medium text-ink">{event.competition.name}</dd>
          </div>
          {event.venue && (
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-ink-2"><MapPin aria-hidden className="size-4" />{t.match.venue}</dt>
              <dd className="mt-1 font-medium text-ink">{event.venue}</dd>
            </div>
          )}
          {(period || clock) && (
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-ink-2"><Timer aria-hidden className="size-4" />{period && clock ? `${t.match.period} · ${t.match.clock}` : period ? t.match.period : t.match.clock}</dt>
              <dd className="tabular mt-1 font-medium text-ink">{[period, clock].filter(Boolean).join(" · ")}</dd>
            </div>
          )}
        </dl>
      </Panel>
      {hasResultPanel && <Panel><EventResult event={event} t={t} /></Panel>}
      {event.shootout && (
        <SpoilerGuard label={t.spoiler.revealResult} quiet>
          <p className="tabular text-sm font-semibold text-ink">{t.match.shootoutScore.replace("{home}", String(event.shootout.home)).replace("{away}", String(event.shootout.away))}</p>
        </SpoilerGuard>
      )}
      {teamDuel && <Suspense fallback={<MatchFormSkeleton />}><MatchForm event={event} t={t} /></Suspense>}
      <ViewingPanel />
      {!duel && event.score.kind === "none" && <p className="text-sm text-ink-2">{t.event.noParticipants}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <EventActions event={event} />
        <ExportButton matchId={event.id} />
      </div>
      <ShareCardButton matchId={event.id} hasResult={hasResult(event)} />
    </div>
  )

  return (
    <AppPage width="md">
      <LiveRefresh live={event.status === "live"} />
      {back}

      <ViewingProvider matchId={event.id}>
      <SpoilerScope>
      <MatchPlayer title={event.eventName || event.participants.map((participant) => participant.name).join(" vs ")} />

      <section aria-label={title} className="fs-band fs-rise relative mt-4 overflow-hidden rounded-2xl p-5 sm:p-7">
        <div aria-hidden className="fs-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-white/80">
              <SportIcon id={event.sportId} className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{event.competition.name}</span>
            </p>
            <span className="rounded-full bg-white/95 dark:bg-surface"><StatusLabel status={event.status} conclusion={event.conclusion} t={t} /></span>
          </div>
          {event.participantType !== "team" && <p className="mt-4 text-[13px] text-white/75">{t.event.types[event.eventType]}</p>}
          {duel && event.eventName && <p className="mt-1 font-semibold text-white/85">{event.eventName}</p>}
          <h1 className={duel ? "sr-only" : "mt-1 text-2xl font-semibold text-white"}>{title}</h1>

          {duel && (
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                <Crest name={home.name} url={home.badgeUrl} size="lg" />
                <p className="min-w-0 break-words text-sm font-semibold leading-5 text-white sm:text-base">{nameOf(home.name, t)}</p>
                <span className="text-white [&_button]:text-white/70 [&_button:hover]:bg-white/10"><FavoriteStar team={home.name} /></span>
              </div>
              <div className="text-center">
                {event.score.kind === "team" && <MatchScore home={event.score.home} away={event.score.away} label={title} />}
                {event.score.kind === "none" && <span className="block max-w-24 text-xs font-medium text-white/75 sm:max-w-32 sm:text-sm">{event.participantType === "team" ? t.match.noScore : t.event.noResult}</span>}
                {event.score.kind !== "team" && event.score.kind !== "none" && <span aria-hidden className="font-display text-xl font-semibold text-white/70">–</span>}
              </div>
              <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                <Crest name={away.name} url={away.badgeUrl} size="lg" />
                <p className="min-w-0 break-words text-sm font-semibold leading-5 text-white sm:text-base">{nameOf(away.name, t)}</p>
                <span className="text-white [&_button]:text-white/70 [&_button:hover]:bg-white/10"><FavoriteStar team={away.name} /></span>
              </div>
            </div>
          )}
        </div>
      </section>

      {event.sourceUpdatedAt && <p className="mt-2 text-xs text-ink-2">{t.match.lastUpdate}: <LocalTime iso={event.sourceUpdatedAt} mode="datetime" /></p>}
      {stale && <Notice tone="warning" role="status" className="mt-3">{t.match.stale}</Notice>}

      <div className="fs-rise mt-5" style={{ ["--i" as string]: 1 }}>
        <MatchDetailProvider matchId={event.id} live={event.status === "live"}>
          <MatchTabs
            overview={overview}
            updates={<LiveUpdatesTab />}
            statistics={<StatisticsTab {...sideNames} breakdown={event.breakdown} />}
            participants={teamDuel ? <LineupsTab {...sideNames} /> : <EntrantsTab event={{ participants: event.participants, score: event.score }} />}
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
