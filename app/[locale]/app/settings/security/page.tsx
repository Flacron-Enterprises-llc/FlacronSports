import type { Metadata } from "next"
import { SecurityPanel } from "@/components/account/security-panel"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Security", robots: { index: false } }

export default async function SecurityPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.security.title} lead={t.security.lead} />
      <SecurityPanel />
    </main>
  )
}
