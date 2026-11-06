import { Users } from "lucide-react"
import { RoomsPanel } from "@/components/community/rooms-panel"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, titled } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.roomsTitle, { robots: { index: false }, referrer: "no-referrer" })

export default async function JoinRoomPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { t } = await pageContext(params)
  const { token } = await params
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <AppPage>
      <PageHeader title={t.community.roomsTitle} lead={t.community.roomsLead} icon={<Users aria-hidden />} />
      {enabled ? <RoomsPanel matchId={null} inviteToken={/^[\w-]{20,100}$/.test(token) ? token : null} /> : <EmptyState icon={<Users aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />}
    </AppPage>
  )
}
