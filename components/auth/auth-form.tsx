"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { pendingPlan, rememberPlan, startCheckout } from "@/lib/billing-client"
import { isBillingInterval, isPaidPlan, PLANS } from "@/lib/billing/plans"
import { requestPasswordReset, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase-auth"
import { completeTotpSignIn, startSecondFactor, type SecondFactorChallenge } from "@/lib/mfa"
import { useLocale } from "@/lib/use-locale"

const FIELD = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-line-strong"

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { t, href } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [planName, setPlanName] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<SecondFactorChallenge | null>(null)
  const [code, setCode] = useState("")

  useEffect(() => {
    const plan = params?.get("plan")
    const interval = params?.get("interval")
    if (isPaidPlan(plan) && isBillingInterval(interval)) rememberPlan({ plan, interval })
    const pending = pendingPlan()
    setPlanName(pending ? PLANS[pending.plan].name : null)
  }, [params])

  const proceed = async (verified: boolean) => {
    if (!verified) return router.push(href("/verify-email"))
    const pending = pendingPlan()
    if (pending) return startCheckout(pending)
    router.push(href(mode === "signup" ? "/pricing" : "/dashboard"))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === "signup" && password !== confirm) return setError(t.auth.mismatch)
    setBusy(true)
    const result = mode === "signup" ? await signUpWithEmail(email, password) : await signInWithEmail(email, password)
    await settle(result)
    setBusy(false)
  }

  const settle = async (result: { user: { emailVerified: boolean } | null; cause?: unknown }) => {
    if (result.user) return proceed(result.user.emailVerified).catch(() => setError(t.auth.failed))
    const pending = startSecondFactor(result.cause)
    if (pending === "unsupported") return setError(t.security.unsupportedFactor)
    if (pending) return setChallenge(pending)
    setError(t.auth.failed)
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!challenge) return
    setError(null)
    setBusy(true)
    try {
      const user = await completeTotpSignIn(challenge, code)
      await proceed(user.emailVerified)
    } catch {
      setError(t.security.badCode)
    }
    setBusy(false)
  }

  const google = async () => {
    setError(null)
    setBusy(true)
    await settle(await signInWithGoogle())
    setBusy(false)
  }

  const reset = async () => {
    if (!email) return setError(t.auth.enterEmail)
    setError(null)
    await requestPasswordReset(email).catch(() => undefined)
    setNotice(t.auth.resetSent)
  }

  if (challenge) {
    return (
      <main id="main" className="mx-auto w-full max-w-md px-4 py-14">
        <form onSubmit={verify} className="rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-md)]">
          <h1 className="text-2xl font-bold text-ink">{t.security.challengeTitle}</h1>
          <p className="mt-2 text-sm text-ink-2">{t.security.challengeBody}</p>
          <label className="mt-6 block text-sm font-medium text-ink">
            {t.security.code}
            <input className={FIELD} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
          <button type="submit" disabled={busy} className="mt-4 w-full rounded-md bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">{t.security.verify}</button>
        </form>
      </main>
    )
  }

  return (
    <main id="main" className="mx-auto w-full max-w-md px-4 py-14">
      <div className="rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl font-bold text-ink">{mode === "signup" ? t.auth.signUpTitle : t.auth.signInTitle}</h1>
        {planName && <p className="mt-2 text-sm text-ink-2">{t.auth.planNote} <strong className="text-ink">{planName}</strong></p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-ink">
            {t.auth.email}
            <input className={FIELD} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-ink">
            {t.auth.password}
            <input className={FIELD} type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === "signup" && (
            <label className="block text-sm font-medium text-ink">
              {t.auth.confirm}
              <input className={FIELD} type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          {notice && <p role="status" className="text-sm text-good">{notice}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-md bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">
            {mode === "signup" ? t.auth.signUp : t.auth.signIn}
          </button>
        </form>
        {mode === "signin" && (
          <button type="button" onClick={reset} className="mt-3 text-sm font-medium text-hot-text underline-offset-2 hover:underline">{t.auth.forgot}</button>
        )}
        <div className="my-5 flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-line" />{t.auth.or}<span className="h-px flex-1 bg-line" /></div>
        <button type="button" onClick={google} disabled={busy} className="w-full rounded-md border border-line py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted disabled:opacity-60">{t.auth.google}</button>
        <p className="mt-5 text-xs leading-5 text-ink-2">
          {t.auth.agree} <Link className="underline" href={href("/terms-of-service")}>{t.auth.terms}</Link> {t.auth.and} <Link className="underline" href={href("/privacy-policy")}>{t.auth.privacy}</Link>.
        </p>
        <p className="mt-4 text-sm text-ink-2">
          {mode === "signup" ? t.auth.hasAccount : t.auth.noAccount}{" "}
          <Link className="font-semibold text-hot-text" href={href(mode === "signup" ? "/signin" : "/signup")}>{mode === "signup" ? t.auth.signIn : t.auth.signUp}</Link>
        </p>
      </div>
    </main>
  )
}
