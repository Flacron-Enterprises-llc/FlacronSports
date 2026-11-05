"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { authFetch } from "@/lib/auth-fetch"
import type { EffectiveAccess } from "@/lib/billing/entitlements"
import { PLANS } from "@/lib/billing/plans"
import { signOutUser } from "@/lib/firebase-auth"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

export function AccountPanel() {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const user = useAuthUser()
  const [access, setAccess] = useState<EffectiveAccess | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await authFetch("/api/billing/status")
    if (response.ok) setAccess(await response.json())
    else setMessage(t.account.failed)
  }, [t])

  useEffect(() => {
    if (user) load().catch(() => setMessage(t.account.failed))
  }, [user, load, t])

  useEffect(() => {
    if (params?.get("checkout") === "canceled") setMessage(t.account.checkoutCanceled)
  }, [params, t])

  if (!user) {
    return (
      <p className="text-ink-2">
        {t.auth.required} <Link className="font-semibold text-hot-text underline" href={href("/signin")}>{t.nav.signIn}</Link>
      </p>
    )
  }

  const date = (seconds: number) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(seconds * 1000))

  const setCancel = async (undo: boolean) => {
    if (!undo && !window.confirm(t.account.confirmCancel)) return
    setBusy(true)
    const response = await authFetch("/api/billing/cancel", { method: "POST", body: JSON.stringify({ undo }) }).catch(() => null)
    if (response?.ok) {
      setMessage(undo ? null : t.account.canceled)
      setAccess((current) => current && { ...current, cancelAtPeriodEnd: !undo, state: undo ? "active" : "canceling" })
    } else setMessage(t.account.failed)
    setBusy(false)
  }

  const portal = async () => {
    const response = await authFetch("/api/billing/portal", { method: "POST" }).catch(() => null)
    const data = response?.ok ? await response.json() : null
    if (data?.url) window.location.assign(data.url)
    else setMessage(t.account.failed)
  }

  const paid = access && access.plan !== "free"

  return (
    <div className="space-y-4">
      {message && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">{message}</p>}
      {access?.state === "past_due" && <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-bad">{t.account.pastDue}</p>}
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-md)]">
        <p className="text-sm text-ink-2">{user.email}</p>
        <h2 className="mt-4 text-sm font-medium text-ink-2">{t.account.plan}</h2>
        {access ? <p className="font-display text-2xl font-semibold text-ink">{PLANS[access.plan].name}</p> : <div className="fs-skeleton mt-1 h-8 w-32" />}
        {paid && access.currentPeriodEnd && (
          <p className="mt-1 text-sm text-ink-2">{access.cancelAtPeriodEnd ? t.account.ends : t.account.renews} {date(access.currentPeriodEnd)}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {paid ? (
            <>
              <button type="button" onClick={portal} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.account.manage}</button>
              <button type="button" disabled={busy} onClick={() => setCancel(access.cancelAtPeriodEnd)} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted disabled:opacity-60">
                {access.cancelAtPeriodEnd ? t.account.undo : t.account.cancel}
              </button>
            </>
          ) : (
            <Link href={href("/pricing")} className="rounded-md bg-orange px-4 py-2 text-sm font-semibold text-[#0a1a33] hover:bg-orange-hover">{t.account.choose}</Link>
          )}
          <button type="button" onClick={() => signOutUser().then(() => router.push(href("/")))} className="rounded-md px-4 py-2 text-sm font-semibold text-ink-2 hover:text-ink">{t.account.signOut}</button>
        </div>
      </section>
    </div>
  )
}
