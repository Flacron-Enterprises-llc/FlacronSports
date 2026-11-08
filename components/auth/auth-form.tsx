"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck, Smartphone } from "lucide-react"
import { AuthHeading, authButton, GoogleButton, LiveError, OrDivider, PasswordField, PasswordRules, PlanChip, SubmitButton, TextField } from "@/components/auth/auth-ui"
import { IconBadge } from "@/components/site/status-card"
import { authErrorField, authErrorKey, isEmail, passwordAccepted, safeNext, type AuthErrorKey } from "@/lib/auth-rules"
import { pendingPlan, rememberPlan, startCheckout, type PendingPlan } from "@/lib/billing-client"
import { isBillingInterval, isPaidPlan } from "@/lib/billing/plans"
import { getCurrentUser, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase-auth"
import { trackGrowthEvent } from "@/lib/growth-engine"
import { localePath } from "@/lib/i18n"
import { completeTotpSignIn, startSecondFactor, type SecondFactorChallenge } from "@/lib/mfa"
import { useLocale } from "@/lib/use-locale"

type AuthResult = { user: { emailVerified: boolean } | null; cause?: unknown; emailSent?: boolean; isNewUser?: boolean }

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const signup = mode === "signup"
  const nextPath = safeNext(params?.get("next"))
  const [email, setEmail] = useState(params?.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false })
  const [error, setError] = useState<string | null>(null)
  const [fieldFailure, setFieldFailure] = useState<{ field: "email" | "password"; key: AuthErrorKey } | null>(null)
  const [busy, setBusy] = useState<"form" | "google" | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [plan, setPlan] = useState<PendingPlan | null>(null)
  const [challenge, setChallenge] = useState<SecondFactorChallenge | null>(null)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const acting = useRef(false)

  useEffect(() => {
    const queryPlan = params?.get("plan")
    const interval = params?.get("interval")
    if (isPaidPlan(queryPlan) && isBillingInterval(interval)) rememberPlan({ plan: queryPlan, interval })
    setPlan(pendingPlan())
  }, [params])

  // One check at load, so a sign-in made on this page is left to proceed().
  useEffect(() => {
    let live = true
    getCurrentUser()
      .then((user) => {
        if (!user || !live || acting.current) return
        setRedirecting(true)
        router.replace(localePath(locale, nextPath ?? "/app"))
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [locale, nextPath, router])

  const showError = (key: AuthErrorKey) => {
    const field = authErrorField(key)
    if (field) setFieldFailure({ field, key })
    else setError(t.auth.errors[key])
  }

  const clearErrors = () => {
    setError(null)
    setFieldFailure(null)
  }

  const proceed = async (verified: boolean, emailSent = false): Promise<boolean> => {
    try {
      if (!verified) {
        const query = new URLSearchParams()
        if (emailSent) query.set("sent", "1")
        if (nextPath) query.set("next", nextPath)
        const search = query.toString()
        router.push(href(`/verify-email${search ? `?${search}` : ""}`))
        return true
      }
      const pending = pendingPlan()
      if (pending) await startCheckout(pending)
      else router.push(href(nextPath ?? (signup ? "/pricing" : "/app")))
      return true
    } catch {
      setError(t.auth.checkoutFailed)
      return false
    }
  }

  const settle = async (result: AuthResult): Promise<boolean> => {
    if (result.user) return proceed(result.user.emailVerified, result.emailSent)
    const pending = startSecondFactor(result.cause)
    if (pending === "unsupported") setError(t.security.unsupportedFactor)
    else if (pending) setChallenge(pending)
    else {
      const key = authErrorKey(result.cause)
      if (key !== "cancelled") showError(key)
    }
    return false
  }

  const emailProblem = fieldFailure?.field === "email" ? fieldFailure.key : null
  const passwordProblem = fieldFailure?.field === "password" ? t.auth.errors[fieldFailure.key] : null
  const signInLink = href(`/signin?email=${encodeURIComponent(email.trim())}${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""}`)
  const emailError = emailProblem === "emailInUse"
    ? <>{t.auth.errors.emailInUse} <Link href={signInLink} className="underline underline-offset-2">{t.auth.signInInstead}</Link></>
    : emailProblem ? t.auth.errors[emailProblem] : touched.email && !isEmail(email) ? t.auth.errors.invalidEmail : null
  const passwordValid = signup ? passwordAccepted(password) : password.length > 0
  const passwordError = passwordProblem ?? (touched.password && !passwordValid ? (signup ? t.auth.errors.weakPassword : t.auth.passwordRequired) : null)
  const confirmError = touched.confirm && password !== confirm ? t.auth.mismatch : null
  const confirmed = confirm.length > 0 && password === confirm

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearErrors()
    setTouched({ email: true, password: true, confirm: true })
    const invalid = !isEmail(email) ? "email" : !passwordValid ? "password" : signup && password !== confirm ? "confirm" : null
    if (invalid) return document.getElementById(invalid)?.focus()
    acting.current = true
    setBusy("form")
    const address = email.trim()
    const result = signup ? await signUpWithEmail(address, password) : await signInWithEmail(address, password)
    if (signup && result.user) trackGrowthEvent("user_registered", { method: "email" })
    const moved = await settle(result)
    if (!moved) setBusy(null)
  }

  const google = async () => {
    clearErrors()
    acting.current = true
    setBusy("google")
    const result = await signInWithGoogle()
    if (result.user && result.isNewUser) trackGrowthEvent("user_registered", { method: "google" })
    if (!(await settle(result))) setBusy(null)
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!challenge) return
    setError(null)
    setCodeError(null)
    if (!/^\d{6}$/.test(code)) {
      setCodeError(t.auth.codeRequired)
      return document.getElementById("code")?.focus()
    }
    setBusy("form")
    try {
      const user = await completeTotpSignIn(challenge, code)
      if (await proceed(user.emailVerified)) return
    } catch (cause) {
      const key = authErrorKey(cause)
      if (key === "tooManyAttempts" || key === "network") setError(t.auth.errors[key])
      else setCodeError(t.security.badCode)
    }
    setBusy(null)
  }

  const leaveChallenge = () => {
    setChallenge(null)
    setCode("")
    setError(null)
    setCodeError(null)
  }

  if (redirecting) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-ink-2">
        <LoaderCircle aria-hidden className="size-[18px] animate-spin" /> {t.auth.working}
      </p>
    )
  }

  if (challenge) {
    return (
      <div>
        <IconBadge icon={ShieldCheck} className="mb-4" />
        <AuthHeading title={t.security.challengeTitle} lead={t.security.challengeBody} />
        <form onSubmit={verify} noValidate className="fs-rise mt-6 space-y-4" style={{ ["--i" as string]: 1 }}>
          <TextField
            id="code"
            label={t.security.code}
            icon={Smartphone}
            error={codeError}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={6}
            className="tabular tracking-[0.3em]"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <LiveError message={error} />
          <SubmitButton busy={busy !== null} busyLabel={t.auth.verifying}>{t.security.verify}</SubmitButton>
        </form>
        <p className="mt-4 text-center">
          <button type="button" onClick={leaveChallenge} className={authButton.textLink}>
            <ArrowLeft aria-hidden className="size-4" /> {t.auth.backToSignIn}
          </button>
        </p>
      </div>
    )
  }

  const switchQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""
  const lead = signup ? (plan ? t.auth.signUpPlanLead : t.auth.signUpLead) : t.auth.signInLead

  return (
    <div>
      <AuthHeading title={signup ? t.auth.signUpTitle : t.auth.signInTitle} lead={lead} />
      {plan && <PlanChip plan={plan.plan} interval={plan.interval} />}

      <div className="fs-rise mt-6" style={{ ["--i" as string]: 1 }}>
        <GoogleButton label={t.auth.google} busy={busy === "google"} disabled={busy !== null} onClick={google} />
        <OrDivider label={signup ? t.auth.orEmailSignUp : t.auth.orEmail} />
      </div>

      <form onSubmit={submit} noValidate className="fs-rise space-y-4" style={{ ["--i" as string]: 2 }}>
        <TextField
          id="email"
          label={t.auth.email}
          icon={Mail}
          error={emailError}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => { setEmail(event.target.value); setFieldFailure(null) }}
          onBlur={() => setTouched((value) => ({ ...value, email: true }))}
        />
        <div>
          <PasswordField
            id="password"
            label={t.auth.password}
            error={passwordError}
            hintId={signup ? "password-rules" : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(event) => { setPassword(event.target.value); setFieldFailure(null) }}
            onBlur={() => setTouched((value) => ({ ...value, password: true }))}
          />
          {signup && <PasswordRules id="password-rules" password={password} />}
          {!signup && (
            <div className="-mb-2 mt-0.5 text-right">
              <Link href={href(`/forgot-password${isEmail(email) ? `?email=${encodeURIComponent(email.trim())}` : ""}`)} className={authButton.textLink}>{t.auth.forgot}</Link>
            </div>
          )}
        </div>
        {signup && (
          <div>
            <PasswordField
              id="confirm"
              label={t.auth.confirm}
              error={confirmError}
              hintId={confirmed ? "confirm-match" : undefined}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              onBlur={() => setTouched((value) => ({ ...value, confirm: true }))}
            />
            <div aria-live="polite">
              {confirmed && <p id="confirm-match" className="fs-fade mt-1.5 text-[13px] font-medium text-good">{t.auth.passwordsMatch}</p>}
            </div>
          </div>
        )}
        <LiveError message={error} />
        <SubmitButton busy={busy === "form"} busyLabel={signup ? t.auth.creating : t.auth.signingIn} disabled={busy !== null}>
          {signup ? t.auth.signUp : t.auth.signIn}
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-xs leading-5 text-ink-2">
        {t.auth.agree} <Link className="underline underline-offset-2 hover:text-ink" href={href("/terms-of-service")}>{t.auth.terms}</Link> {t.auth.and} <Link className="underline underline-offset-2 hover:text-ink" href={href("/privacy-policy")}>{t.auth.privacy}</Link>.
      </p>
      <p className="mt-2 text-center text-sm text-ink-2">
        {signup ? t.auth.hasAccount : t.auth.noAccount}{" "}
        <Link className={authButton.textLink} href={href(`${signup ? "/signin" : "/signup"}${switchQuery}`)}>{signup ? t.auth.signIn : t.auth.signUp}</Link>
      </p>
    </div>
  )
}
