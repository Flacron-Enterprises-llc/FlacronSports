"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LoaderCircle, Mail, RefreshCw } from "lucide-react"
import { AuthHeading, authButton, Notice, SubmitButton } from "@/components/auth/auth-ui"
import { AnimatedCheck, IconBadge } from "@/components/site/status-card"
import { authErrorKey, safeNext } from "@/lib/auth-rules"
import { pendingPlan, startCheckout } from "@/lib/billing-client"
import { getCurrentUser, refreshVerification, resendVerification, signOutUser } from "@/lib/firebase-auth"
import { trackEmailVerified } from "@/lib/growth-engine"
import { localePath } from "@/lib/i18n"
import { useLocale } from "@/lib/use-locale"

const COOLDOWN_SECONDS = 60
const SUCCESS_PAUSE_MS = 1200

type Message = { tone: "good" | "bad" | "info"; text: string }

export function VerifyEmail() {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = safeNext(params?.get("next"))
  const justSent = params?.get("sent") === "1"
  const [address, setAddress] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(justSent ? COOLDOWN_SECONDS : 0)
  const [busy, setBusy] = useState<"check" | "resend" | null>(null)
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState<Message | null>(justSent ? { tone: "good", text: t.auth.resent } : null)
  const leaving = useRef(false)

  const check = useCallback(async (manual: boolean) => {
    if (leaving.current) return
    if (manual) {
      setBusy("check")
      setMessage(null)
    }
    try {
      if (await refreshVerification()) {
        leaving.current = true
        setVerified(true)
        const user = await getCurrentUser().catch(() => null)
        if (user) trackEmailVerified(user.uid)
        await new Promise((resolve) => setTimeout(resolve, SUCCESS_PAUSE_MS))
        const pending = pendingPlan()
        if (pending) await startCheckout(pending)
        else router.replace(localePath(locale, nextPath ?? "/pricing"))
      } else if (manual) {
        setMessage({ tone: "info", text: t.auth.notYet })
      }
    } catch {
      if (leaving.current) {
        leaving.current = false
        setVerified(false)
        setMessage({ tone: "bad", text: t.auth.checkoutFailed })
      } else if (manual) {
        setMessage({ tone: "bad", text: t.auth.errors.network })
      }
    }
    if (manual) setBusy(null)
  }, [locale, nextPath, router, t])

  useEffect(() => {
    let live = true
    getCurrentUser()
      .then((user) => {
        if (!live) return
        if (!user) return router.replace(localePath(locale, `/signin${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`))
        setAddress(user.email)
        void check(false)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [check, locale, nextPath, router])

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") void check(false)
    }
    window.addEventListener("focus", onReturn)
    document.addEventListener("visibilitychange", onReturn)
    return () => {
      window.removeEventListener("focus", onReturn)
      document.removeEventListener("visibilitychange", onReturn)
    }
  }, [check])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const resend = async () => {
    setBusy("resend")
    setMessage(null)
    try {
      await resendVerification()
      setCooldown(COOLDOWN_SECONDS)
      setMessage({ tone: "good", text: t.auth.resent })
    } catch (cause) {
      const key = authErrorKey(cause)
      if (key === "tooManyAttempts") setCooldown(COOLDOWN_SECONDS)
      setMessage({ tone: "bad", text: t.auth.errors[key === "cancelled" ? "failed" : key] })
    }
    setBusy(null)
  }

  const useOtherEmail = async () => {
    await signOutUser()
    router.push(href("/signup"))
  }

  const [before, after] = t.auth.verifySent.split("{email}")

  return (
    <div>
      <p role="status" className="sr-only">{verified ? `${t.auth.verifiedTitle}. ${t.auth.verifiedBody}` : ""}</p>
      {verified ? (
        <>
          <AnimatedCheck className="mb-4" />
          <AuthHeading title={t.auth.verifiedTitle} lead={t.auth.verifiedBody} />
          <LoaderCircle aria-hidden className="mt-6 size-5 animate-spin text-ink-3" />
        </>
      ) : (
        <>
          <IconBadge icon={Mail} tone="hot" className="mb-4" />
          <AuthHeading
            title={t.auth.verifyTitle}
            lead={address ? <>{before}<strong className="font-semibold text-ink [overflow-wrap:anywhere]">{address}</strong>{after}</> : t.auth.verifyBody}
          />
          <ol className="fs-rise mt-5 space-y-2 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm text-ink-2" style={{ ["--i" as string]: 1 }}>
            {[t.auth.verifyStep1, t.auth.verifyStep2, t.auth.verifyStep3].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted font-display text-xs font-semibold text-ink">{index + 1}</span>
                <span className="min-w-0 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div aria-live="polite" className="mt-4 empty:mt-0">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>
          <div className="fs-rise mt-4 space-y-2.5" style={{ ["--i" as string]: 2 }}>
            <SubmitButton type="button" busy={busy === "check"} busyLabel={t.auth.checking} disabled={busy !== null} onClick={() => check(true)}>{t.auth.verified}</SubmitButton>
            <SubmitButton type="button" variant="outline" busy={busy === "resend"} busyLabel={t.auth.sending} disabled={busy !== null || cooldown > 0} onClick={resend}>
              <RefreshCw aria-hidden className="size-4" />
              {cooldown > 0 ? t.auth.resendIn.replace("{seconds}", String(cooldown)) : t.auth.resend}
            </SubmitButton>
          </div>
          <p className="mt-4 text-center text-[13px] leading-5 text-ink-2">
            {t.auth.verifyHelp}{" "}
            <button type="button" onClick={useOtherEmail} className={authButton.textLink}>{t.auth.verifyOther}</button>
          </p>
        </>
      )}
    </div>
  )
}
