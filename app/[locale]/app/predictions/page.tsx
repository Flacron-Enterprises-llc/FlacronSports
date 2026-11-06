import Link from "next/link"
import { Medal } from "lucide-react"
import { GroupsPanel } from "@/components/community/groups-panel"
import { Leaderboard } from "@/components/community/leaderboard"
import { MyBadges } from "@/components/community/my-badges"
import { MyPredictions } from "@/components/community/my-predictions"
import { ReferralPanel } from "@/components/community/referral-panel"
import { RuleList } from "@/components/community/rule-list"
import { AppPage, btn, EmptyState, PageHeader, Panel } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.predictionsTitle, { robots: { index: false } })

export default async function PredictionsPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <AppPage width="lg">
      <PageHeader title={t.community.predictionsTitle} lead={t.community.predictionsLead} icon={<Medal aria-hidden />} actions={enabled ? <Link href={href("/app/scores?status=upcoming")} className={btn("navy")}>{t.ui.findMatch}</Link> : undefined} />
      {enabled ? (
        <div className="space-y-5">
          <MyPredictions />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Panel title={t.community.leaderboard}><Leaderboard /></Panel>
            <Panel title={t.community.pointRules}><RuleList /></Panel>
          </div>
          <GroupsPanel />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <MyBadges />
            <ReferralPanel />
          </div>
        </div>
      ) : (
        <EmptyState icon={<Medal aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />
      )}
    </AppPage>
  )
}
