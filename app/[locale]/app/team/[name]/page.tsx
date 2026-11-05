import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EmptyState, PageHeader } from "@/components/site/states"
import { EventCard, FeedNotice } from "@/components/sports/event-card"
import { FavoriteStar } from "@/components/sports/parts"
import { pageContext } from "@/lib/page-context"
import { enabledSports, getTeamFixtures } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"

export const revalidate = 300

type Props = { params: Promise<{ locale: string; name: string }>; searchParams: Promise<{ sport?: string }> }

function decodeName(raw: string): string | null {
  try {
    const name = decodeURIComponent(raw).trim()
    return name && name.length <= 120 && !name.includes("/") ? name : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeName((await params).name)
  return name ? { title: name } : {}
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { t, href } = await pageContext(params)
  const name = decodeName((await params).name)
  if (!name) notFound()

  const wanted = (await searchParams).sport
  const sport = enabledSports().find((item) => item.id === wanted)?.id
  const { team, upcoming, recent, feed } = await getTeamFixtures(name, sport)
  const displayName = team?.name ?? name

  const list = (heading: string, events: SportEvent[]) =>
    events.length > 0 && (
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-ink">{heading}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => <EventCard key={event.id} event={event} t={t} href={href} timeMode="datetime" />)}
        </div>
      </section>
    )

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={displayName} lead={t.team.lead} />
      <FavoriteStar team={displayName} />
      {list(t.team.upcoming, upcoming)}
      {list(t.team.recent, recent)}
      {feed.state !== "unavailable" && !team && <EmptyState title={t.team.notFound} body={t.team.notFoundBody} action={{ href: href("/app/scores"), label: t.team.browse }} />}
      {feed.state !== "unavailable" && team && upcoming.length + recent.length === 0 && <EmptyState title={t.team.noFixtures} body={t.team.noFixturesBody} action={{ href: href("/app/scores"), label: t.team.browse }} />}
      <div className="mt-4"><FeedNotice feed={{ ...feed, events: [] }} t={t} /></div>
    </main>
  )
}
