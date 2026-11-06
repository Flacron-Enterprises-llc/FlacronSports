import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ListOrdered, Newspaper, Shield } from "lucide-react"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, EmptyState, PageHeader, Panel } from "@/components/site/states"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import { FavoriteStar, LocalTime, SpoilerGuard, SpoilerReveal, SpoilerScope } from "@/components/sports/parts"
import { TeamWatchPanel } from "@/components/video/team-watch-panel"
import { listPublishedReports } from "@/lib/content/reports"
import { pageContext } from "@/lib/page-context"
import { formByGame, tableAround, type FormResult } from "@/lib/sports/detail"
import { enabledSports, getStandings, getTeamFixtures, type StandingRow } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { videoFor } from "@/lib/video/catalog"
import { loadWatchFeed } from "@/lib/video/load-feed"

export const dynamic = "force-dynamic"

const REPORT_LIMIT = 4
const VIDEO_LIMIT = 3

type Props = { params: Promise<{ locale: string; name: string }>; searchParams: Promise<{ sport?: string }> }

function decodeName(raw: string): string | null {
  try {
    const name = decodeURIComponent(raw).trim()
    return name && name.length <= 120 && !name.includes("/") ? name : null
  } catch {
    return null
  }
}

/** A listed video counts only once it passes the same approval check as Watch. */
async function checkedVideos(events: SportEvent[]) {
  const candidates = events.filter((event) => event.videoUrl).slice(0, VIDEO_LIMIT * 2)
  const checked = await Promise.all(candidates.map(async (event) => ({ event, video: await videoFor(event).catch(() => null) })))
  return checked.flatMap(({ event, video }) => (video ? [{ event, channel: video.channel }] : [])).slice(0, VIDEO_LIMIT)
}

const FORM_TONE: Record<FormResult, string> = { win: "bg-good text-white", draw: "bg-surface-muted text-ink-2", loss: "bg-bad text-white" }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeName((await params).name)
  return name ? { title: name } : {}
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const copy = t.discover
  const name = decodeName((await params).name)
  if (!name) notFound()

  const wanted = (await searchParams).sport
  const sport = enabledSports().find((item) => item.id === wanted)?.id
  const { team, upcoming, recent, feed } = await getTeamFixtures(name, sport)
  if (feed.state === "withheld") return <MemberDataPending />
  const displayName = team?.name ?? name

  const leagueId = team?.league?.id
  const [standings, { reports }, videos, watch] = await Promise.all([
    leagueId ? getStandings(leagueId) : null,
    team ? listPublishedReports(locale) : { reports: [] },
    team ? checkedVideos(recent) : [],
    team ? loadWatchFeed(team.sportId, { team: team.name }) : null,
  ])
  const related = reports.filter((report) => report.participants.some((item) => item.toLowerCase() === displayName.toLowerCase())).slice(0, REPORT_LIMIT)
  const rows: StandingRow[] = standings?.state === "ok" ? tableAround(standings.rows, displayName) : []
  const form = formByGame(recent, displayName)

  const list = (heading: string, events: SportEvent[]) =>
    events.length > 0 && (
      <section aria-label={heading} className="mb-7">
        <h2 className="text-[17px] font-semibold text-ink">{heading}</h2>
        <div className="fs-stagger mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} timeMode="datetime" />)}
        </div>
      </section>
    )

  return (
    <AppPage>
      <PageHeader title={displayName} lead={t.team.lead} icon={<Shield aria-hidden />} actions={<span className="rounded-lg border border-line bg-surface"><FavoriteStar team={displayName} /></span>} />
      {list(t.team.upcoming, upcoming)}
      {list(t.team.recent, recent)}

      {(form.length > 0 || rows.length > 0) && (
        <SpoilerScope>
          <div className="mb-7 space-y-4">
            <SpoilerReveal label={copy.revealForm} />
            <SpoilerGuard label={copy.revealForm} quiet>
              <div className="grid gap-4 lg:grid-cols-2">
                {form.length > 0 && (
                  <Panel title={copy.form} description={copy.formLast.replace("{count}", String(form.length))}>
                    <ol className="flex gap-1.5">
                      {form.map(({ eventId, result }) => (
                        <li key={eventId}>
                          <Link href={href(`/app/match/${eventId}`)} aria-label={copy.formNames[result]} title={copy.formNames[result]} className={cn("tabular inline-flex size-9 items-center justify-center rounded-md text-sm font-semibold", FORM_TONE[result])}>{copy.formLetters[result]}</Link>
                        </li>
                      ))}
                    </ol>
                  </Panel>
                )}
                {rows.length > 0 && (
                  <Panel title={team?.league?.name ?? copy.standings} icon={<ListOrdered aria-hidden />} actions={<Link href={href(`/app/standings/${leagueId}`)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-hot-text hover:underline">{copy.fullTable}<ArrowRight aria-hidden className="size-3.5" /></Link>}>
                    <table className="w-full text-sm">
                      <caption className="sr-only">{copy.standings}</caption>
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-ink-2">
                          <th scope="col" className="py-1.5 pr-2 font-medium">{t.standings.rank}</th>
                          <th scope="col" className="py-1.5 pr-2 font-medium">{t.standings.team}</th>
                          <th scope="col" className="py-1.5 pl-2 text-right font-medium">{t.standings.played}</th>
                          <th scope="col" className="py-1.5 pl-2 text-right font-medium">{t.standings.points}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const own = row.team.toLowerCase() === displayName.toLowerCase()
                          return (
                            <tr key={`${row.rank}-${row.team}`} aria-current={own ? "true" : undefined} className={cn("border-b border-line last:border-0", own && "font-semibold text-ink")}>
                              <td className="tabular py-1.5 pr-2 text-ink-2">{row.rank ?? "–"}</td>
                              <th scope="row" className="min-w-0 py-1.5 pr-2 text-left font-medium text-ink">{row.team}</th>
                              <td className="tabular py-1.5 pl-2 text-right text-ink-2">{row.played ?? "–"}</td>
                              <td className="tabular py-1.5 pl-2 text-right text-ink">{row.points ?? "–"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </Panel>
                )}
              </div>
            </SpoilerGuard>
          </div>
        </SpoilerScope>
      )}

      {team && <TeamWatchPanel sport={team.sportId} team={team.name} recent={videos} feed={watch?.feed ?? null} t={t} href={href} />}

      {related.length > 0 && (
        <Panel className="mb-7" title={copy.relatedReports} icon={<Newspaper aria-hidden />}>
          <ul className="-my-2 divide-y divide-line">
            {related.map((report) => (
              <li key={report.id} className="py-2.5">
                <Link href={href(`/app/news/${report.slug}`)} className="block text-sm font-medium leading-5 text-ink underline-offset-2 hover:underline">{report.title}</Link>
                <p className="mt-0.5 truncate text-xs text-ink-2">{report.competition}{report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {feed.state !== "unavailable" && !team && <EmptyState icon={<Shield aria-hidden />} title={t.team.notFound} body={t.team.notFoundBody} action={{ href: href(`/app/scores?q=${encodeURIComponent(name)}`), label: t.team.browse }} />}
      {feed.state !== "unavailable" && team && upcoming.length + recent.length === 0 && <EmptyState icon={<Shield aria-hidden />} title={t.team.noFixtures} body={t.team.noFixturesBody} action={{ href: href("/app/scores"), label: t.team.browse }} />}
      <div className="mt-4"><FeedNotice feed={{ ...feed, events: [] }} t={t} /></div>
    </AppPage>
  )
}
