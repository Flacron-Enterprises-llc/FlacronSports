"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, LinkIcon, LoaderCircle } from "lucide-react"
import { AuthHeading, authButton, LiveError, PasswordField, PasswordRules, SubmitButton } from "@/components/auth/auth-ui"
import { AnimatedCheck, IconBadge } from "@/components/site/status-card"
import { authErrorKey, passwordAccepted } from "@/lib/auth-rules"
import { pendingPlan, startCheckout } from "@/lib/billing-client"
import { applyEmailCode, confirmReset, getCurrentUser, refreshVerification } from "@/lib/firebase-auth"
import { trackEmailVerified } from "@/lib/growth-engine"
import { localePath } from "@/lib/i18n"
import { useLocale } from "@/lib/use-locale"

const SUCCESS_PAUSE_MS = 1500

type State = "working" | "reset" | "verified" | "saved" | "failed"

/** Handles Firebase one-time codes on our own domain instead of a firebaseapp.com page. */
export function AuthAction() {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const mode = params?.get("mode")
  const code = params?.get("oobCode") ?? ""
  const [state, setState] = useState<State>(!code ? "failed" : mode === "resetPassword" ? "reset" : mode === "verifyEmail" ? "working" : "failed")
  const [signedIn, setSignedIn] = useState(false)
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState(false)
  const [weak, setWeak] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const applied = useRef(false)

  useEffect(() => {
    if (state !== "working" || applied.current) return
    applied.current = true
    applyEmailCode(code).then(
      async () => {
        setState("verified")
        const user = await getCurrentUser().catch(() => null)
        if (!user || !(await refreshVerification().catch(() => false))) return
        trackEmailVerified(user.uid)
        setSignedIn(true)
        await new Promise((resolve) => setTimeout(resolve, SUCCESS_PAUSE_MS))
        const pricing = localePath(locale, "/pricing")
        const pending = pendingPlan()
        if (pending) await startCheckout(pending).catch(() => router.replace(pricing))
        else router.replace(pricing)
      },
      () => setState("failed"),
    )
  }, [code, locale, router, state])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setTouched(true)
    setWeak(false)
    setError(null)
    if (!passwordAccepted(password)) return document.getElementById("password")?.focus()
    setBusy(true)
    try {
      await confirmReset(code, password)
      setState("saved")
    } catch (cause) {
      const key = authErrorKey(cause)
      if (key === "weakPassword") setWeak(true)
      else if (key === "network" || key === "tooManyAttempts") setError(t.auth.errors[key])
      else setState("failed")
    }
    setBusy(false)
  }

  const status = { working: t.auth.working, reset: "", verified: t.auth.verifiedTitle, saved: t.auth.resetDoneTitle, failed: t.auth.actionFailedTitle }[state]

  return (
    <div>
      <p role="status" className="sr-only">{status}</p>
      {state === "working" && (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink-2">
          <LoaderCircle aria-hidden className="size-[18px] animate-spin" /> {t.auth.working}
        </p>
      )}
      {state === "verified" && (
        <>
          <AnimatedCheck className="mb-4" />
          <AuthHeading title={t.auth.verifiedTitle} lead={signedIn ? t.auth.verifiedBody : t.auth.required} />
          {signedIn
            ? <LoaderCircle aria-hidden className="mt-6 size-5 animate-spin text-ink-3" />
            : <Link href={href("/signin")} className={`${authButton.primary} mt-6`}>{t.auth.signIn}</Link>}
        </>
      )}
      {state === "saved" && (
        <>
          <AnimatedCheck className="mb-4" />
          <AuthHeading title={t.auth.resetDoneTitle} lead={t.auth.resetDoneBody} />
          <Link href={href("/signin")} className={`${authButton.primary} mt-6`}>{t.auth.signIn}</Link>
        </>
      )}
      {state === "failed" && (
        <>
          <IconBadge icon={LinkIcon} tone="bad" className="mb-4" />
          <AuthHeading title={t.auth.actionFailedTitle} lead={t.auth.actionFailed} />
          <div className="mt-6 space-y-2.5">
            {mode === "resetPassword" && <Link href={href("/forgot-password")} className={authButton.primary}>{t.auth.requestNewLink}</Link>}
            <Link href={href("/signin")} className={mode === "resetPassword" ? authButton.outline : authButton.primary}>{t.auth.backToSignIn}</Link>
          </div>
        </>
      )}
      {state === "reset" && (
        <>
          <IconBadge icon={KeyRound} className="mb-4" />
          <AuthHeading title={t.auth.newPassword} lead={t.auth.newPasswordLead} />
          <form onSubmit={submit} noValidate className="fs-rise mt-6 space-y-4" style={{ ["--i" as string]: 1 }}>
            <div>
              <PasswordField
                id="password"
                label={t.auth.password}
                error={weak || (touched && !passwordAccepted(password)) ? t.auth.errors.weakPassword : null}
                hintId="password-rules"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => { setPassword(event.target.value); setWeak(false) }}
                onBlur={() => setTouched(true)}
              />
              <PasswordRules id="password-rules" password={password} />
            </div>
            <LiveError message={error} />
            <SubmitButton busy={busy} busyLabel={t.auth.saving}>{t.auth.saveNewPassword}</SubmitButton>
          </form>
        </>
      )}
    </div>
  )
}
