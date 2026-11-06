import { notFound } from "next/navigation"
import { Flag } from "lucide-react"
import { ClubView } from "@/components/community/club-view"
import { AppPage, EmptyState } from "@/components/site/states"
import { pageContext, titled } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.clubsTitle, { robots: { index: false } })

export default async function ClubPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { t } = await pageContext(params)
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()
  return (
    <AppPage width="md">
      {process.env.COMMUNITY_ENABLED === "true" ? <ClubView id={id} /> : <EmptyState icon={<Flag aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />}
    </AppPage>
  )
}
