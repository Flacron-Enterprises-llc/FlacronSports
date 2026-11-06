import { Users } from "lucide-react"
import { RoomsPanel } from "@/components/community/rooms-panel"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, titled } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.roomsTitle, { robots: { index: false } })

export default async function RoomsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ match?: string }> }) {
  const { t } = await pageContext(params)
  const { match } = await searchParams
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <AppPage>
      <PageHeader title={t.community.roomsTitle} lead={t.community.roomsLead} icon={<Users aria-hidden />} />
      {enabled ? <RoomsPanel matchId={match && /^tsdb-\d+$/.test(match) ? match : null} /> : <EmptyState icon={<Users aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />}
    </AppPage>
  )
}
