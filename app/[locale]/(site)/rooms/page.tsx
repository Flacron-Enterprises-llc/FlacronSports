import type { Metadata } from "next"
import { RoomsPanel } from "@/components/community/rooms-panel"
import { EmptyState, PageHeader } from "@/components/site/states"
import { pageContext } from "@/lib/page-context"

export const metadata: Metadata = { title: "Private rooms", robots: { index: false } }

export default async function RoomsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ match?: string }> }) {
  const { t } = await pageContext(params)
  const { match } = await searchParams
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
      <PageHeader title={t.community.roomsTitle} lead={t.community.roomsLead} />
      {enabled ? <RoomsPanel matchId={match && /^tsdb-\d+$/.test(match) ? match : null} /> : <EmptyState title={t.community.offTitle} body={t.community.offBody} />}
    </main>
  )
}
