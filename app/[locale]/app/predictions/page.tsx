import type { Metadata } from "next"
import { Leaderboard } from "@/components/community/leaderboard"
import { EmptyState, PageHeader } from "@/components/site/states"
import { pageContext } from "@/lib/page-context"

export const metadata: Metadata = { title: "Predictions", robots: { index: false } }

export default async function PredictionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { t } = await pageContext(params)
  const enabled = process.env.COMMUNITY_ENABLED === "true"
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
      <PageHeader title={t.community.predictionsTitle} lead={t.community.predictionsLead} />
      {enabled ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-semibold text-ink">{t.community.pointRules}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-2">{t.community.predictionRules}</p>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5"><Leaderboard /></section>
        </div>
      ) : (
        <EmptyState title={t.community.offTitle} body={t.community.offBody} />
      )}
    </main>
  )
}
