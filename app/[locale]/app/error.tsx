"use client"

import { useEffect } from "react"
import { TriangleAlert, WifiOff } from "lucide-react"
import { useOnline } from "@/components/dashboard/controls"
import { AppPage, btn, EmptyState } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"

export default function AppError({ error, reset }: { error: Error; reset(): void }) {
  const { t } = useLocale()
  const online = useOnline()
  useEffect(() => console.error("App page failed", error.message), [error])
  return (
    <AppPage width="sm">
      <EmptyState icon={online ? <TriangleAlert aria-hidden /> : <WifiOff aria-hidden />} title={online ? t.common.error : t.common.offline} body={online ? t.ui.errorBody : t.ui.offline}>
        <button type="button" onClick={reset} className={btn("navy")}>{t.common.retry}</button>
      </EmptyState>
    </AppPage>
  )
}
