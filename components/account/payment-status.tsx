"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

const POLL_MS = 2000
const MAX_ATTEMPTS = 15

// Reaching this page proves nothing: paid access exists only once the verified
// webhook has written the entitlement, so this page waits for that record.
export function PaymentStatus() {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [state, setState] = useState<"confirming" | "done" | "delayed">("confirming")

  useEffect(() => {
    if (!user) return
    let active = true
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      attempts += 1
      const response = await authFetch("/api/billing/status").catch(() => null)
      const data = response?.ok ? await response.json() : null
      if (!active) return
      if (data?.isPaid) return setState("done")
      if (attempts >= MAX_ATTEMPTS) return setState("delayed")
      timer = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user])

  const [title, body] = { confirming: [t.paid.confirming, t.paid.confirmingBody], done: [t.paid.done, t.paid.doneBody], delayed: [t.paid.delayed, t.paid.delayedBody] }[state]

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-md)]">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">{body}</p>
      {state !== "confirming" && <Link href={href("/dashboard")} className="mt-5 inline-block font-semibold text-hot-text underline">{t.paid.go}</Link>}
    </div>
  )
}
