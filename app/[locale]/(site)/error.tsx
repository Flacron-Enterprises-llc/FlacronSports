"use client"

import Link from "next/link"
import { TriangleAlert } from "lucide-react"
import { authButton } from "@/components/auth/auth-ui"
import { IconBadge, StatusCard } from "@/components/site/status-card"
import { useLocale } from "@/lib/use-locale"

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t, href } = useLocale()
  return (
    <main id="main" className="relative flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]" />
      <div className="relative flex w-full justify-center">
        <StatusCard visual={<IconBadge icon={TriangleAlert} tone="warn" />} title={t.common.error} body={t.common.errorBody}>
          <button type="button" onClick={reset} className={authButton.primary}>{t.common.retry}</button>
          <Link href={href("/")} className={authButton.outline}>{t.common.home}</Link>
        </StatusCard>
      </div>
    </main>
  )
}
