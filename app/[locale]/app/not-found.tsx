"use client"

import { SearchX } from "lucide-react"
import { AppPage, EmptyState } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"

export default function AppNotFound() {
  const { t, href } = useLocale()
  return (
    <AppPage width="sm">
      <EmptyState icon={<SearchX aria-hidden />} title={t.common.notFound} body={t.ui.notFoundBody} action={{ href: href("/app"), label: t.dash.dashboard }} />
    </AppPage>
  )
}
