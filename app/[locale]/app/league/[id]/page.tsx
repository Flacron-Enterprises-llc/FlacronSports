import Link from "next/link"
import { notFound } from "next/navigation"
import { Trophy } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, btn, EmptyState, Notice, PageHeader, SectionHeading } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { pageContext, titled } from "@/lib/page-context"
import { canHaveTable } from "@/lib/sports/calculated"
import { getLeagueEvents } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"

export const generateMetadata = titled((t) => t.scores.competition, { robots: { index: false } })
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string; id: string }> }

export default async function LeaguePage({ params }: Props) {
  const { id } = await params
  if (!/^\d{1,8}$/.test(id)) notFound()
  const { t, href } = await pageContext(params)
  const league = await getLeagueEvents(id)
  if (league.state === "withheld") return <MemberDataPending />

  const section = (title: string, events: SportEvent[]) => events.length > 0 && (
    <section className="mt-5">
      <SectionHeading title={title} />
      <div className="fs-settle mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} timeMode="datetime" />)}
      </div>
    </section>
  )

  return (
    <AppPage>
      <PageHeader
        title={league.competition ?? t.scores.competition}
        icon={<Trophy aria-hidden />}
        actions={league.sportId && league.competition && canHaveTable(league.sportId, league.competition) ? <Link href={href(`/app/standings/${id}`)} className={btn("outline", "md")}>{t.discover.fullTable}</Link> : undefined}
      />
      {league.state === "unavailable" && <ErrorNotice>{t.feed.unavailable}</ErrorNotice>}
      {league.state === "stale" && <Notice tone="warning" role="status">{t.feed.stale}</Notice>}
      {league.state === "empty" && <EmptyState icon={<Trophy aria-hidden />} title={t.scores.empty} body={t.ui.scoresEmptyBody} />}
      {section(t.scores.upcoming, league.upcoming)}
      {section(t.scores.finished, league.recent)}
    </AppPage>
  )
}
