import { Medal } from "lucide-react"
import { GroupsPanel } from "@/components/community/groups-panel"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, titled } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.groupsTitle, { robots: { index: false }, referrer: "no-referrer" })

export default async function JoinGroupPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { t } = await pageContext(params)
  const { token } = await params
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <AppPage>
      <PageHeader title={t.community.groupsTitle} lead={t.community.groupsLead} icon={<Medal aria-hidden />} />
      {enabled ? <GroupsPanel inviteToken={/^[\w-]{20,100}$/.test(token) ? token : null} /> : <EmptyState icon={<Medal aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />}
    </AppPage>
  )
}
