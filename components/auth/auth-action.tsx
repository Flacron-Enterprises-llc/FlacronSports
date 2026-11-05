"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { applyEmailCode, confirmReset } from "@/lib/firebase-auth"
import { pendingPlan, startCheckout } from "@/lib/billing-client"
import { useLocale } from "@/lib/use-locale"

/** Handles Firebase one-time codes on our own domain instead of a firebaseapp.com page. */
export function AuthAction() {
  const { t, href } = useLocale()
  const params = useSearchParams()
  const mode = params?.get("mode")
  const code = params?.get("oobCode") ?? ""
  const [state, setState] = useState<"working" | "done" | "failed" | "reset">(mode === "resetPassword" ? "reset" : "working")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (mode !== "verifyEmail") return
    applyEmailCode(code)
      .then(async () => {
        setState("done")
        const pending = pendingPlan()
        if (pending) await startCheckout(pending).catch(() => undefined)
      })
      .catch(() => setState("failed"))
  }, [mode, code])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setState("working")
    await confirmReset(code, password).then(() => setState("done")).catch(() => setState("failed"))
  }

  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 py-14">
      <div className="rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-md)]">
        {state === "working" && <p role="status" className="text-ink-2">{t.auth.working}</p>}
        {state === "done" && (
          <>
            <h1 className="text-2xl font-bold text-ink">{t.auth.actionDone}</h1>
            <Link href={href("/signin")} className="mt-4 inline-block font-semibold text-hot-text underline">{t.nav.signIn}</Link>
          </>
        )}
        {state === "failed" && <p role="alert" className="text-bad">{t.auth.actionFailed}</p>}
        {state === "reset" && (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-2xl font-bold text-ink">{t.auth.newPassword}</h1>
            <label className="block text-sm font-medium text-ink">
              {t.auth.password}
              <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" />
            </label>
            <button type="submit" className="w-full rounded-md bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-deep">{t.auth.saveNewPassword}</button>
          </form>
        )}
      </div>
    </main>
  )
}
