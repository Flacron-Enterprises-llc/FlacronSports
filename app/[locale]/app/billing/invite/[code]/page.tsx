import { Gift } from "lucide-react"
import { ReferralClaim } from "@/components/community/referral-claim"
import { AppPage, EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, titled } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.inviteTitle, { robots: { index: false }, referrer: "no-referrer" })

/** Under billing because an account with no plan can open that path, and that is who this is for. */
export default async function InvitePage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { t } = await pageContext(params)
  const { code } = await params
  return (
    <AppPage>
      <PageHeader title={t.community.inviteTitle} lead={t.community.inviteBody} icon={<Gift aria-hidden />} />
      {process.env.COMMUNITY_ENABLED === "true" ? <ReferralClaim code={code} /> : <EmptyState icon={<Gift aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />}
    </AppPage>
  )
}
