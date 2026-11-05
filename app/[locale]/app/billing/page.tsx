import { Suspense } from "react"
import type { Metadata } from "next"
import { AccountPanel } from "@/components/account/account-panel"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Account", robots: { index: false } }

export default async function DashboardPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.account.title} />
      <Suspense><AccountPanel /></Suspense>
    </main>
  )
}
