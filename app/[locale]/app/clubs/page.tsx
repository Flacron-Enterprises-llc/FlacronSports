import { Flag } from "lucide-react"
import { ClubsPanel } from "@/components/community/clubs-panel"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.clubsTitle, { robots: { index: false } })

export default async function ClubsPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <AppPage>
      <PageHeader title={t.community.clubsTitle} lead={t.community.clubsLead} icon={<Flag aria-hidden />} />
      {enabled ? <ClubsPanel /> : <EmptyState icon={<Flag aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />}
    </AppPage>
  )
}
