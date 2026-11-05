import { Suspense } from "react"
import type { Metadata } from "next"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { AddonOffers } from "@/components/billing/addon-offers"
import { PageHeader } from "@/components/site/states"
import { addonOnSale, ADDONS } from "@/lib/billing/addons"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Sports assistant" }

export default async function AssistantPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  const offers = Object.values(ADDONS).filter((addon) => addonOnSale(addon.sku)).map((addon) => addon.sku)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
      <PageHeader title={t.assistant.title} lead={t.assistant.lead} />
      <Suspense fallback={null}><AssistantPanel /></Suspense>
      <AddonOffers skus={offers} />
    </main>
  )
}
