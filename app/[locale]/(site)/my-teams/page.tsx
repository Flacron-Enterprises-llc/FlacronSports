import type { Metadata } from "next"
import { MyTeams } from "@/components/account/my-teams"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "My Teams", robots: { index: false } }

export default async function MyTeamsPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.myTeams.title} lead={t.myTeams.lead} />
      <MyTeams />
    </main>
  )
}
