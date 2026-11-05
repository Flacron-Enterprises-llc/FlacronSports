"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { pendingPlan, startCheckout } from "@/lib/billing-client"
import { refreshVerification, resendVerification } from "@/lib/firebase-auth"
import { useLocale } from "@/lib/use-locale"

export function VerifyEmail() {
  const { t, href } = useLocale()
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)

  const check = async () => {
    setMessage(null)
    try {
      if (!(await refreshVerification())) return setMessage(t.auth.notYet)
      const pending = pendingPlan()
      if (pending) await startCheckout(pending)
      else router.push(href("/pricing"))
    } catch {
      setMessage(t.account.failed)
    }
  }

  const resend = async () => {
    try {
      await resendVerification()
      setMessage(t.auth.resent)
    } catch {
      setMessage(t.account.failed)
    }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 py-14">
      <div className="rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl font-bold text-ink">{t.auth.verifyTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-ink-2">{t.auth.verifyBody}</p>
        {message && <p role="status" className="mt-3 text-sm text-ink">{message}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={check} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.auth.verified}</button>
          <button type="button" onClick={resend} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted">{t.auth.resend}</button>
        </div>
      </div>
    </main>
  )
}
