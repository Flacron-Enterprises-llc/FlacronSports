import type { Metadata } from "next"
import { RoomsPanel } from "@/components/community/rooms-panel"
import { EmptyState, PageHeader } from "@/components/site/states"
import { pageContext } from "@/lib/page-context"

export const metadata: Metadata = { title: "Private rooms", robots: { index: false }, referrer: "no-referrer" }

export default async function JoinRoomPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { t } = await pageContext(params)
  const { token } = await params
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
      <PageHeader title={t.community.roomsTitle} lead={t.community.roomsLead} />
      {enabled ? <RoomsPanel matchId={null} inviteToken={/^[\w-]{20,100}$/.test(token) ? token : null} /> : <EmptyState title={t.community.offTitle} body={t.community.offBody} />}
    </main>
  )
}
