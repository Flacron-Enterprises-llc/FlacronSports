import Link from "next/link"
import { Medal, ScrollText, Trophy } from "lucide-react"
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
        <div className="space-y-4">
          <MyPredictions />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title={t.community.leaderboard} icon={<Trophy aria-hidden />}><Leaderboard /></Panel>
            <MyBadges />
          </div>
          <GroupsPanel />
          <Panel title={t.community.pointRules} icon={<ScrollText aria-hidden />}><RuleList wide /></Panel>
          <ReferralPanel />
        </div>
      ) : (
        <EmptyState icon={<Medal aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />
      )}
    </AppPage>
  )
}
