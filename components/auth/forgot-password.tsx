"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react"
import { AuthHeading, authButton, LiveError, SubmitButton, TextField } from "@/components/auth/auth-ui"
import { IconBadge } from "@/components/site/status-card"
import { isEmail } from "@/lib/auth-rules"
import { requestPasswordReset } from "@/lib/firebase-auth"
import { useLocale } from "@/lib/use-locale"

export function ForgotPassword() {
  const { t, href } = useLocale()
  const params = useSearchParams()
  const [email, setEmail] = useState(params?.get("email") ?? "")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailError = touched && !isEmail(email) ? t.auth.errors.invalidEmail : null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setTouched(true)
    setError(null)
    if (!isEmail(email)) return document.getElementById("email")?.focus()
    setBusy(true)
    try {
      const response = await requestPasswordReset(email.trim())
      if (response.status === 429) setError(t.auth.errors.tooManyAttempts)
      else setSent(true)
    } catch {
      setError(t.auth.errors.network)
    }
    setBusy(false)
  }

  const useOtherEmail = () => {
    setSent(false)
    setTouched(false)
  }

  const [before, after] = t.auth.forgotSentBody.split("{email}")

  return (
    <div>
      <p role="status" className="sr-only">{sent ? t.auth.forgotSentTitle : ""}</p>
      {sent ? (
        <>
          <IconBadge icon={MailCheck} tone="good" className="mb-4" />
          <AuthHeading title={t.auth.forgotSentTitle} lead={<>{before}<strong className="font-semibold text-ink [overflow-wrap:anywhere]">{email.trim()}</strong>{after}</>} />
          <div className="fs-rise mt-6 space-y-2.5" style={{ ["--i" as string]: 1 }}>
            <Link href={href("/signin")} className={authButton.primary}>{t.auth.backToSignIn}</Link>
            <button type="button" onClick={useOtherEmail} className={authButton.outline}>{t.auth.forgotOther}</button>
          </div>
        </>
      ) : (
        <>
          <IconBadge icon={KeyRound} className="mb-4" />
          <AuthHeading title={t.auth.forgotTitle} lead={t.auth.forgotLead} />
          <form onSubmit={submit} noValidate className="fs-rise mt-6 space-y-4" style={{ ["--i" as string]: 1 }}>
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
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            <LiveError message={error} />
            <SubmitButton busy={busy} busyLabel={t.auth.sending}>{t.auth.forgotSend}</SubmitButton>
          </form>
          <p className="mt-4 text-center">
            <Link href={href("/signin")} className={authButton.textLink}><ArrowLeft aria-hidden className="size-4" /> {t.auth.backToSignIn}</Link>
          </p>
        </>
      )}
    </div>
  )
}
