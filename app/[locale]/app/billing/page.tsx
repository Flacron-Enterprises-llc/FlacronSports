import { Suspense } from "react"
import { CreditCard } from "lucide-react"
import { AccountPanel } from "@/components/account/account-panel"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.dash.billing, { robots: { index: false } })

export default async function Page({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="md">
      <PageHeader title={t.dash.billing} lead={t.ui.billingLead} icon={<CreditCard aria-hidden />} />
      <Suspense><AccountPanel /></Suspense>
    </AppPage>
  )
}
