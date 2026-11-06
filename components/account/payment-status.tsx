"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Clock, LoaderCircle } from "lucide-react"
import { authButton } from "@/components/auth/auth-ui"
import { useAccount } from "@/components/dashboard/account-context"
import { AnimatedCheck, IconBadge, StatusCard } from "@/components/site/status-card"
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
  const router = useRouter()
  const { reload } = useAccount()
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
      if (data?.isPaid) {
        // The shell read the plan before the webhook landed and would keep showing the paywall.
        await reload()
        router.refresh()
        if (active) setState("done")
        return
      }
      if (attempts >= MAX_ATTEMPTS) return setState("delayed")
      timer = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user, reload, router])

  const [title, body] = { confirming: [t.paid.confirming, t.paid.confirmingBody], done: [t.paid.done, t.paid.doneBody], delayed: [t.paid.delayed, t.paid.delayedBody] }[state]
  const visual = {
    confirming: <span className="fs-tint-brand inline-flex size-[72px] items-center justify-center rounded-full text-brand"><LoaderCircle aria-hidden className="size-8 animate-spin" /></span>,
    done: <AnimatedCheck />,
    delayed: <IconBadge icon={Clock} tone="warn" />,
  }[state]

  return (
    <div role="status" aria-live="polite" className="flex w-full justify-center">
      <StatusCard key={state} visual={visual} title={title} body={body}>
        {state !== "confirming" && <Link href={href(state === "done" ? "/app" : "/app/billing")} className={authButton.primary}>{state === "done" ? t.paid.enter : t.paid.go}</Link>}
      </StatusCard>
    </div>
  )
}
