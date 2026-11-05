"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOutUser } from "@/lib/firebase-auth"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import type { AlertType } from "@/lib/me/preferences-defaults"
import { useLocale } from "@/lib/use-locale"
import { usePreferences } from "./prefs-provider"
import { startTour } from "@/components/tour/app-tour"

const ALERTS: AlertType[] = ["start", "final", "participants", "scoring", "interval", "highlights"]
const CARD = "rounded-2xl border border-line bg-surface p-6"
const ROW = "flex items-center justify-between gap-4 py-2 text-sm text-ink"

export function SettingsPanel() {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const user = useAuthUser()
  const { prefs, update } = usePreferences()
  const [message, setMessage] = useState<string | null>(null)
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"]

  useEffect(() => {
    if (user && prefs.timeZone === "UTC") {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detected && detected !== "UTC") void update({ timeZone: detected })
    }
  }, [user, prefs.timeZone, update])

  const save = async (patch: Parameters<typeof update>[0]) => {
    setMessage((await update(patch)) ? t.settings.saved : t.account.failed)
  }

  const toggleAlert = (type: AlertType) => {
    const types = prefs.alerts.types.includes(type) ? prefs.alerts.types.filter((item) => item !== type) : [...prefs.alerts.types, type]
    return save({ alerts: { ...prefs.alerts, types } })
  }

  const exportData = async () => {
    const response = await authFetch("/api/me/export").catch(() => null)
    if (!response?.ok) return setMessage(t.account.failed)
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = "flacronsport-data.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const deleteAccount = async () => {
    if (!window.confirm(t.settings.deleteConfirm)) return
    const response = await authFetch("/api/me", { method: "DELETE" }).catch(() => null)
    if (!response?.ok) return setMessage(t.account.failed)
    await signOutUser()
    router.push(href("/"))
  }

  const hours = Array.from({ length: 24 }, (_, hour) => hour)

  return (
    <div className="space-y-4">
      {message && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">{message}</p>}

      <section aria-labelledby="s-general" className={CARD}>
        <h2 id="s-general" className="text-lg font-semibold text-ink">{t.settings.general}</h2>
        <label className={ROW}>
          {t.settings.language}
          <select className="rounded-md border border-line bg-surface px-2 py-1" value={locale} onChange={(event) => { void save({ locale: event.target.value as "en" | "fr" }); router.push(event.target.value === "fr" ? "/fr/settings" : "/settings") }}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        {user && (
          <label className={ROW}>
            {t.settings.timeZone}
            <select className="max-w-52 rounded-md border border-line bg-surface px-2 py-1" value={prefs.timeZone} onChange={(event) => save({ timeZone: event.target.value })}>
              {[...new Set(["UTC", prefs.timeZone, ...zones])].map((zone) => <option key={zone}>{zone}</option>)}
            </select>
          </label>
        )}
        <label className={ROW}>
          <span>{t.settings.spoiler}<span className="block text-xs text-ink-2">{t.settings.spoilerHelp}</span></span>
          <input type="checkbox" className="size-5" checked={prefs.spoilerMode} onChange={(event) => save({ spoilerMode: event.target.checked })} />
        </label>
        <label className={ROW}>
          <span>{t.settings.lowData}<span className="block text-xs text-ink-2">{t.settings.lowDataHelp}</span></span>
          <input type="checkbox" className="size-5" checked={prefs.lowData} onChange={(event) => save({ lowData: event.target.checked })} />
        </label>
      </section>

      {user ? (
        <>
          <section aria-labelledby="s-alerts" className={CARD}>
            <h2 id="s-alerts" className="text-lg font-semibold text-ink">{t.settings.alerts}</h2>
            <label className={ROW}>
              {t.settings.mute}
              <input type="checkbox" className="size-5" checked={prefs.alerts.muted} onChange={(event) => save({ alerts: { ...prefs.alerts, muted: event.target.checked } })} />
            </label>
            <fieldset>
              <legend className="mt-2 text-sm font-medium text-ink">{t.settings.alertTypes}</legend>
              {ALERTS.map((type) => (
                <label key={type} className={ROW}>
                  {t.settings.alertNames[type]}
                  <input type="checkbox" className="size-5" checked={prefs.alerts.types.includes(type)} onChange={() => toggleAlert(type)} />
                </label>
              ))}
            </fieldset>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink">
              {(["quietStart", "quietEnd"] as const).map((field) => (
                <label key={field} className="flex items-center gap-2">
                  {t.settings[field]}
                  <select className="rounded-md border border-line bg-surface px-2 py-1" value={prefs.alerts[field] ?? ""} onChange={(event) => save({ alerts: { ...prefs.alerts, [field]: event.target.value === "" ? null : Number(event.target.value) } })}>
                    <option value="">{t.settings.off}</option>
                    {hours.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="s-privacy" className={CARD}>
            <h2 id="s-privacy" className="text-lg font-semibold text-ink">{t.settings.privacy}</h2>
            <label className={ROW}>
              <span>{t.settings.newsletter}<span className="block text-xs text-ink-2">{t.settings.newsletterHelp}</span></span>
              <input type="checkbox" className="size-5" checked={prefs.newsletter.optedIn} onChange={(event) => save({ newsletter: { ...prefs.newsletter, optedIn: event.target.checked } })} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={exportData} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted">{t.settings.export}</button>
              <button type="button" onClick={deleteAccount} className="rounded-md border border-bad px-4 py-2 text-sm font-semibold text-bad hover:bg-surface-muted">{t.settings.delete}</button>
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-ink-2">{t.settings.guest} <Link className="font-semibold text-hot-text underline" href={href("/signin")}>{t.nav.signIn}</Link></p>
      )}

      <section aria-labelledby="s-help" className={CARD}>
        <h2 id="s-help" className="text-lg font-semibold text-ink">{t.settings.help}</h2>
        <button type="button" onClick={startTour} className="mt-3 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-muted">{t.tour.replay}</button>
      </section>
    </div>
  )
}
