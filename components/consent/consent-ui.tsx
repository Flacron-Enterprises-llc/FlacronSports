"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { COOKIE_CATEGORIES } from "@/lib/legal/content"
import { useLocale } from "@/lib/use-locale"
import { useConsent, type CookieCategory } from "./consent-provider"

const BUTTON =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
const PRIMARY = "bg-navy text-white hover:bg-navy-deep dark:bg-brand dark:text-brand-on dark:hover:opacity-90"
const GHOST = "border border-line bg-transparent text-ink hover:border-line-strong hover:bg-surface-muted"

/*
 * Full-width frosted strip pinned to the bottom edge, shared with the other
 * Flacron sites. Rejecting is exactly as prominent as accepting. It sits above
 * the mobile tab bar, and optional technologies stay off until a choice is made.
 */
function CookieBanner() {
  const consent = useConsent()
  const { t, href } = useLocale()
  const id = useId()

  return (
    <div
      role="region"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onKeyDown={(event) => event.key === "Escape" && consent.dismissBanner()}
      className="fs-consent fs-glass fixed inset-x-0 bottom-0 z-[65] border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-t`} className="font-sans text-[14px] font-semibold leading-5 tracking-normal text-ink">{t.consent.title}</h2>
          <p id={`${id}-d`} className="mt-1 text-[13px] leading-relaxed text-ink-2">
            {t.consent.body}{" "}
            <Link href={href("/cookie-policy")} className="font-semibold text-hot-text underline underline-offset-2">{t.consent.policy}</Link>
          </p>
          {consent.gpcApplied && (
            <p role="status" className="mt-2 flex items-start gap-2 text-[12.5px] leading-5 text-ink-2">
              <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-good" />
              {t.consent.gpc}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className={`${BUTTON} ${PRIMARY}`} onClick={() => consent.acceptAll("banner")}>{t.consent.accept}</button>
          <button type="button" className={`${BUTTON} ${GHOST}`} onClick={() => consent.rejectNonEssential("banner")}>{t.consent.reject}</button>
          <button type="button" className={`${BUTTON} ${GHOST}`} onClick={consent.openPreferences}>{t.consent.manage}</button>
        </div>
      </div>
    </div>
  )
}

function CookiePreferences() {
  const consent = useConsent()
  const { t } = useLocale()
  const [draft, setDraft] = useState<CookieCategory[]>(["necessary"])
  const base = useId()

  useEffect(() => {
    if (consent.preferencesOpen) setDraft(consent.categories)
  }, [consent.preferencesOpen, consent.categories])

  return (
    <Dialog open={consent.preferencesOpen} onOpenChange={(open) => !open && consent.closePreferences()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.consent.prefs}</DialogTitle>
          <DialogDescription>{t.consent.prefsLead}</DialogDescription>
        </DialogHeader>
        {consent.gpc && <p className="text-[13px] text-ink-2">{t.consent.gpc}</p>}
        <ul className="divide-y divide-line">
          {COOKIE_CATEGORIES.map((category) => {
            const always = category.id === "necessary"
            return (
              <li key={category.id} className="flex items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p id={`${base}-${category.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {category.name}
                    {always && <span className="rounded-full bg-surface-muted px-2 py-px text-[11px] text-ink-3">{t.consent.always}</span>}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{category.text}</p>
                  {category.id === "analytics" && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t.consent.analyticsNote}</p>}
                </div>
                <Switch
                  aria-labelledby={`${base}-${category.id}`}
                  checked={always || draft.includes(category.id)}
                  disabled={always}
                  onCheckedChange={(on) =>
                    setDraft((current) => (on ? [...current, category.id] : current.filter((value) => value !== category.id)))
                  }
                />
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={`${BUTTON} ${GHOST}`} onClick={() => consent.rejectNonEssential("preferences")}>{t.consent.reject}</button>
          <button type="button" className={`${BUTTON} ${GHOST}`} onClick={() => consent.save(draft)}>{t.consent.save}</button>
          <button type="button" className={`${BUTTON} ${PRIMARY}`} onClick={() => consent.acceptAll("preferences")}>{t.consent.accept}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CookieConsent() {
  const consent = useConsent()
  return (
    <>
      {consent.ready && consent.bannerOpen && <CookieBanner />}
      <CookiePreferences />
    </>
  )
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  const consent = useConsent()
  const { t } = useLocale()
  return (
    <button type="button" onClick={consent.openPreferences} className={`fs-link text-left ${className ?? ""}`}>
      {t.footer.cookies}
    </button>
  )
}
