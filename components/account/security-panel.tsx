"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { TotpSecret } from "firebase/auth"
import { ArrowLeft, ExternalLink, KeyRound, LoaderCircle } from "lucide-react"
import { useAccount } from "@/components/dashboard/account-context"
import { CopyButton } from "@/components/dashboard/controls"
import { btn, Notice, Panel } from "@/components/site/states"
import { enrolledTotp, finishTotpEnrolment, mfaFailure, startTotpEnrolment, type MfaFailure } from "@/lib/mfa"
import { useLocale } from "@/lib/use-locale"

export function SecurityPanel() {
  const { t, href } = useLocale()
  const { user } = useAccount()
  const [enrolled, setEnrolled] = useState(false)
  const [setup, setSetup] = useState<{ secret: TotpSecret; key: string; uri: string } | null>(null)
  const [code, setCode] = useState("")
  const [failure, setFailure] = useState<MfaFailure | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) setEnrolled(enrolledTotp(user).length > 0)
  }, [user])

  if (!user) return null

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
    <div className="space-y-4">
      <Link href={href("/app/settings")} className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-hot-text hover:underline"><ArrowLeft aria-hidden className="size-4" />{t.settings.title}</Link>
      {done && <Notice tone="success" role="status">{t.security.signInAgain}</Notice>}
      {failure && <Notice tone="danger" role="alert">{messages[failure]}</Notice>}
      <Panel title={t.security.totpTitle} description={enrolled ? t.security.enrolled : t.security.totpBody} icon={<KeyRound aria-hidden />}>
        {!enrolled && !setup && (
          <button type="button" disabled={busy} onClick={start} className={btn("navy")}>
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {t.security.start}
          </button>
        )}
        {setup && (
          <form onSubmit={finish} className="space-y-4">
            <p className="text-sm leading-6 text-ink-2">{t.security.secretHelp}</p>
            <div>
              <p className="text-sm font-medium text-ink">{t.security.secret}</p>
              <code className="mt-1 block break-all rounded-lg border border-line bg-surface-muted p-2.5 text-sm text-ink">{setup.key}</code>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton value={setup.key} label={t.community.copy} done={t.community.copied} />
                <a href={setup.uri} className={btn("outline", "sm")}><ExternalLink aria-hidden className="size-3.5" />{t.security.uri}</a>
              </div>
            </div>
            <label className="block text-sm font-medium text-ink">
              {t.security.code}
              <input className="fs-input mt-1 h-10 max-w-[12rem] px-3 tracking-widest" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <button type="submit" disabled={busy} className={btn("navy")}>{t.security.verify}</button>
          </form>
        )}
      </Panel>
    </div>
  )
}
