import type { Metadata } from "next"
import { SettingsPanel } from "@/components/account/settings-panel"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Settings", robots: { index: false } }

export default async function SettingsPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.settings.title} />
      <SettingsPanel />
    </main>
  )
}
