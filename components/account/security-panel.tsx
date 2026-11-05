"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { TotpSecret } from "firebase/auth"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { enrolledTotp, finishTotpEnrolment, mfaFailure, startTotpEnrolment, type MfaFailure } from "@/lib/mfa"
import { useLocale } from "@/lib/use-locale"

export function SecurityPanel() {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [enrolled, setEnrolled] = useState(false)
  const [setup, setSetup] = useState<{ secret: TotpSecret; key: string; uri: string } | null>(null)
  const [code, setCode] = useState("")
  const [failure, setFailure] = useState<MfaFailure | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) setEnrolled(enrolledTotp(user).length > 0)
  }, [user])

  if (!user) {
    return <p className="text-ink-2">{t.auth.required} <Link className="font-semibold text-hot-text underline" href={href("/signin")}>{t.nav.signIn}</Link></p>
  }

  const messages: Record<MfaFailure, string> = {
    disabled: t.security.disabled,
    recent_login: t.security.recentLogin,
    unverified: t.security.unverified,
    bad_code: t.security.badCode,
    failed: t.account.failed,
  }

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    try {
      await task()
    } catch (error) {
      setFailure(mfaFailure(error))
    }
    setBusy(false)
  }

  const start = () => run(async () => setSetup(await startTotpEnrolment(user)))

  const finish = (event: React.FormEvent) => {
    event.preventDefault()
    if (!setup) return
    run(async () => {
      await finishTotpEnrolment(user, setup.secret, code, t.security.factorName)
      setSetup(null)
      setEnrolled(true)
      setDone(true)
    })
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-ink">{t.security.totpTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-2">{enrolled ? t.security.enrolled : t.security.totpBody}</p>
      {done && <p role="status" className="mt-3 text-sm text-good">{t.security.signInAgain}</p>}
      {failure && <p role="alert" className="mt-3 text-sm text-bad">{messages[failure]}</p>}

      {!enrolled && !setup && (
        <button type="button" disabled={busy} onClick={start} className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">{t.security.start}</button>
      )}

      {setup && (
        <form onSubmit={finish} className="mt-4 space-y-3">
          <p className="text-sm text-ink-2">{t.security.secretHelp}</p>
          <div>
            <p className="text-sm font-medium text-ink">{t.security.secret}</p>
            <code className="mt-1 block break-all rounded-md border border-line bg-surface-muted p-2 text-sm text-ink">{setup.key}</code>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{t.security.uri}</p>
            <code className="mt-1 block break-all rounded-md border border-line bg-surface-muted p-2 text-xs text-ink">{setup.uri}</code>
          </div>
          <label className="block text-sm font-medium text-ink">
            {t.security.code}
            <input className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button type="submit" disabled={busy} className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60">{t.security.verify}</button>
        </form>
      )}
    </section>
  )
}
