import Link from "next/link"
import { Medal } from "lucide-react"
import { Leaderboard } from "@/components/community/leaderboard"
import { AppPage, btn, EmptyState, PageHeader, Panel } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.community.predictionsTitle, { robots: { index: false } })

export default async function PredictionsPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <AppPage width="md">
      <PageHeader title={t.community.predictionsTitle} lead={t.community.predictionsLead} icon={<Medal aria-hidden />} actions={enabled ? <Link href={href("/app/scores?status=upcoming")} className={btn("navy")}>{t.ui.findMatch}</Link> : undefined} />
      {enabled ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={t.community.leaderboard}><Leaderboard /></Panel>
          <Panel title={t.community.pointRules}><p className="text-sm leading-6 text-ink-2">{t.community.predictionRules}</p></Panel>
        </div>
      ) : (
        <EmptyState icon={<Medal aria-hidden />} title={t.community.offTitle} body={t.community.offBody} />
      )}
    </AppPage>
  )
}
