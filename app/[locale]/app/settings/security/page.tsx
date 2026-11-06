import { ShieldCheck } from "lucide-react"
import { SecurityPanel } from "@/components/account/security-panel"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.security.title, { robots: { index: false } })

export default async function Page({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="sm">
      <PageHeader title={t.security.title} lead={t.security.lead} icon={<ShieldCheck aria-hidden />} />
      <SecurityPanel />
    </AppPage>
  )
}
