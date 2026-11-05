import type { Metadata } from "next"
import Link from "next/link"
import { SettingsPanel } from "@/components/account/settings-panel"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Settings", robots: { index: false } }

export default async function SettingsPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.settings.title} />
      <SettingsPanel />
      <p className="mt-6 text-sm"><Link href={href("/settings/security")} className="font-semibold text-hot-text hover:underline">{t.security.title}</Link></p>
    </main>
  )
}
