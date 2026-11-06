"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronRight, CircleHelp, Lock, ShieldCheck, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { useAccount } from "@/components/dashboard/account-context"
import { Switch, useConfirm } from "@/components/dashboard/controls"
import { btn, Panel } from "@/components/site/states"
import { startTour } from "@/components/tour/app-tour"
import { authFetch } from "@/lib/auth-fetch"
import { signOutUser } from "@/lib/firebase-auth"
import { localePath } from "@/lib/i18n"
import type { AlertType } from "@/lib/me/preferences-defaults"
import { readStored, SPOILER_DECIDED_KEY, writeStored } from "@/lib/storage-consent"
import { SPORTS } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { usePreferences } from "./prefs-provider"

const ALERT_ROWS: AlertType[] = ["start", "final", "participants", "scoring", "interval", "highlights"]
const PAID_ALERTS: AlertType[] = ["participants", "scoring", "interval", "highlights"]
const DETECTED_KEY = "fs-time-zone-detected"

function Row({ title, help, children }: { title: string; help?: string; children: (labelId: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p id={id} className="text-sm font-medium text-ink">{title}</p>
        {help && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{help}</p>}
      </div>
      {children(id)}
    </div>
  )
}

export function SettingsPanel() {
  const { locale, t, href } = useLocale()
  const router = useRouter()
  const { user, plan } = useAccount()
  const { prefs, ready, update } = usePreferences()
  const filters = prefs.alerts.filters ?? { sports: [], majorOnly: false }
  const { confirm, dialog } = useConfirm()
  const [zones, setZones] = useState<string[]>(["UTC"])

  useEffect(() => {
    if (typeof Intl.supportedValuesOf === "function") setZones(Intl.supportedValuesOf("timeZone"))
  }, [])

  // Detected once per browser, so choosing UTC later is respected.
  useEffect(() => {
    if (!user || !ready || readStored<boolean>(DETECTED_KEY, false)) return
    writeStored(DETECTED_KEY, true)
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (prefs.timeZone === "UTC" && detected && detected !== "UTC") void update({ timeZone: detected })
  }, [user, ready, prefs.timeZone, update])

  const save = async (patch: Parameters<typeof update>[0]) => {
    if (await update(patch)) toast(t.settings.saved)
    else toast(t.ui.saveFailed)
  }

  const toggleAlert = (type: AlertType) => {
    const types = prefs.alerts.types.includes(type) ? prefs.alerts.types.filter((item) => item !== type) : [...prefs.alerts.types, type]
    return save({ alerts: { ...prefs.alerts, types } })
  }

  const exportData = async () => {
    const response = await authFetch("/api/me/export").catch(() => null)
    if (!response?.ok) return void toast(t.account.failed)
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = "flacronsport-data.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const deleteAccount = async () => {
    if (!(await confirm(t.settings.deleteConfirm, true))) return
    const response = await authFetch("/api/me", { method: "DELETE" }).catch(() => null)
    if (!response?.ok) return void toast(t.account.failed)
    await signOutUser()
    router.push(href("/"))
  }

  const changeLanguage = (next: "en" | "fr") => {
    void update({ locale: next })
    router.push(localePath(next, "/app/settings"))
  }

  const sections = [["general", t.settings.general], ["alerts", t.settings.alerts], ["privacy", t.settings.privacy], ["help", t.settings.help]]
  const selectClass = "fs-input h-9 w-auto max-w-[11rem] px-2 text-sm"

  return (
    <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
      {dialog}
      <nav aria-label={t.settings.title} className="fs-noscrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
        {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink">{label}</a>)}
        <Link href={href("/app/settings/security")} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink">{t.security.title}</Link>
      </nav>

      <div className="fs-stagger min-w-0 space-y-5">
        <Panel id="general" title={t.settings.general} icon={<SlidersHorizontal aria-hidden />}>
          <div className="divide-y divide-line">
            <Row title={t.settings.language}>
              {(id) => (
                <select aria-labelledby={id} className={selectClass} value={locale} onChange={(event) => changeLanguage(event.target.value as "en" | "fr")}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              )}
            </Row>
            <Row title={t.settings.timeZone}>
              {(id) => (
                <select aria-labelledby={id} className={selectClass} value={prefs.timeZone} onChange={(event) => save({ timeZone: event.target.value })}>
                  {[...new Set(["UTC", prefs.timeZone, ...zones])].map((zone) => <option key={zone}>{zone}</option>)}
                </select>
              )}
            </Row>
            <Row title={t.settings.spoiler} help={t.settings.spoilerHelp}>
              {(id) => <Switch labelledBy={id} checked={prefs.spoilerMode} onChange={(spoilerMode) => { writeStored(SPOILER_DECIDED_KEY, true); void save({ spoilerMode }) }} />}
            </Row>
            <Row title={t.settings.lowData} help={t.settings.lowDataHelp}>
              {(id) => <Switch labelledBy={id} checked={prefs.lowData} onChange={(lowData) => save({ lowData })} />}
            </Row>
          </div>
        </Panel>

        <Panel id="alerts" title={t.settings.alerts} icon={<Bell aria-hidden />}>
          <div className="divide-y divide-line">
            <Row title={t.settings.mute}>
              {(id) => <Switch labelledBy={id} checked={prefs.alerts.muted} onChange={(muted) => save({ alerts: { ...prefs.alerts, muted } })} />}
            </Row>
            <Row title={t.alerts.emailToggle} help={t.alerts.emailToggleHelp}>
              {(id) => <Switch labelledBy={id} disabled={prefs.alerts.muted} checked={prefs.alerts.email === true} onChange={(email) => save({ alerts: { ...prefs.alerts, email } })} />}
            </Row>
          </div>
          <fieldset className="mt-4 border-t border-line pt-4">
            <legend className="sr-only">{t.settings.alertTypes}</legend>
            <p aria-hidden className="mb-1 text-[13px] font-semibold text-ink">{t.settings.alertTypes}</p>
            <div className="divide-y divide-line">
              {ALERT_ROWS.map((type) => {
                const locked = plan === "free" && PAID_ALERTS.includes(type)
                return (
                  <Row key={type} title={t.settings.alertNames[type]} help={locked ? t.settings.alertPaid : undefined}>
                    {(id) => <Switch labelledBy={id} disabled={prefs.alerts.muted || locked} checked={!locked && prefs.alerts.types.includes(type)} onChange={() => toggleAlert(type)} />}
                  </Row>
                )
              })}
            </div>
          </fieldset>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] font-semibold text-ink">{t.settings.alertFilters}</p>
            {plan === "premium" ? (
              <>
                <p className="mt-1 text-xs leading-5 text-ink-2">{t.settings.alertFiltersHelp}</p>
                <Row title={t.settings.majorOnly}>
                  {(id) => <Switch labelledBy={id} disabled={prefs.alerts.muted} checked={filters.majorOnly} onChange={(majorOnly) => save({ alerts: { ...prefs.alerts, filters: { ...filters, majorOnly } } })} />}
                </Row>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SPORTS.filter((sport) => sport.enabled).map((sport) => {
                    const active = filters.sports.includes(sport.id)
                    return (
                      <button key={sport.id} type="button" aria-pressed={active} disabled={prefs.alerts.muted} onClick={() => save({ alerts: { ...prefs.alerts, filters: { ...filters, sports: active ? filters.sports.filter((item) => item !== sport.id) : [...filters.sports, sport.id] } } })} className={`min-h-8 rounded-full border px-3 text-[13px] font-medium ${active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:text-ink"}`}>
                        {sport.name[locale]}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2"><Lock aria-hidden className="size-3.5" />{t.settings.alertFiltersLocked}</p>
            )}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] leading-5 text-ink-2">{t.ui.quietHelp}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink">
              {(["quietStart", "quietEnd"] as const).map((field) => (
                <label key={field} className="flex items-center gap-2 whitespace-nowrap">
                  {t.settings[field]}
                  <select className="fs-input h-9 w-auto px-2 text-sm" value={prefs.alerts[field] ?? ""} onChange={(event) => save({ alerts: { ...prefs.alerts, [field]: event.target.value === "" ? null : Number(event.target.value) } })}>
                    <option value="">{t.settings.off}</option>
                    {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </Panel>

        <Panel id="privacy" title={t.settings.privacy} icon={<ShieldCheck aria-hidden />}>
          <Row title={t.settings.newsletter} help={t.settings.newsletterHelp}>
            {(id) => <Switch labelledBy={id} checked={prefs.newsletter.optedIn} onChange={(optedIn) => save({ newsletter: { ...prefs.newsletter, optedIn } })} />}
          </Row>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" onClick={exportData} className={btn("outline")}>{t.settings.export}</button>
            <button type="button" onClick={deleteAccount} className={btn("danger")}>{t.settings.delete}</button>
          </div>
        </Panel>

        <Panel id="help" title={t.settings.help} icon={<CircleHelp aria-hidden />}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startTour} className={btn("outline")}>{t.tour.replay}</button>
            <Link href={href("/app/settings/security")} className={btn("ghost")}>{t.security.title}<ChevronRight aria-hidden className="size-4" /></Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
