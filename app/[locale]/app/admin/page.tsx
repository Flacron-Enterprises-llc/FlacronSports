import { Shield } from "lucide-react"
import { AdminGate } from "@/components/admin/admin-gate"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.admin.title, { robots: { index: false } })

export default async function Page({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="md">
      <PageHeader title={t.admin.title} icon={<Shield aria-hidden />} />
      <AdminGate />
    </AppPage>
  )
}
