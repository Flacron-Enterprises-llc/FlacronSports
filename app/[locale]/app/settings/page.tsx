import { Settings } from "lucide-react"
import { SettingsPanel } from "@/components/account/settings-panel"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.settings.title, { robots: { index: false } })

export default async function Page({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="md">
      <PageHeader title={t.settings.title} lead={t.ui.settingsLead} icon={<Settings aria-hidden />} />
      <SettingsPanel />
    </AppPage>
  )
}
