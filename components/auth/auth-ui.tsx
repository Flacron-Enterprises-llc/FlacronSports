"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Check, CircleAlert, CircleCheck, Eye, EyeOff, Info, Languages, LoaderCircle, Lock, type LucideIcon } from "lucide-react"
import { buttonClass } from "@/components/site/marketing/button"
import { passwordChecks } from "@/lib/auth-rules"
import { PLANS, type BillingInterval, type PaidPlanId } from "@/lib/billing/plans"
import { localePath } from "@/lib/i18n"
import { useLocale } from "@/lib/use-locale"

const CONTROL_STATES = "w-full focus-visible:rounded-lg disabled:pointer-events-none disabled:opacity-60"

export const authButton = {
  primary: buttonClass("primary", "lg", `${CONTROL_STATES} text-[#0a1a33]`),
  outline: buttonClass("outline", "lg", CONTROL_STATES),
  textLink: "fs-link inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-hot-text",
}

function describedBy(id: string, error: unknown, extra?: string) {
  return [error ? `${id}-error` : null, extra].filter(Boolean).join(" ") || undefined
}

export function AuthHeading({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <div className="fs-rise">
      <h1 className="text-[1.6rem] font-semibold leading-tight text-ink sm:text-[1.8rem]">{title}</h1>
      {lead && <p className="mt-1.5 text-[15px] leading-6 text-ink-2">{lead}</p>}
    </div>
  )
}

function Field({ id, label, error, children }: { id: string; label: string; error?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      <div className="relative mt-1.5">{children}</div>
      <div aria-live="polite">
        {error && (
          <p id={`${id}-error`} className="fs-fade mt-1.5 flex gap-1.5 text-[13px] font-medium leading-5 text-bad">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">{error}</span>
          </p>
        )}
      </div>
    </div>
  )
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & { id: string; label: string; error?: React.ReactNode; hintId?: string }

export function TextField({ id, label, icon: Icon, error, hintId, className = "", ...rest }: FieldProps & { icon: LucideIcon }) {
  return (
    <Field id={id} label={label} error={error}>
      <Icon aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" />
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hintId)} className={`fs-control pl-11 pr-3.5 ${className}`} {...rest} />
    </Field>
  )
}

export function PasswordField({ id, label, error, hintId, ...rest }: Omit<FieldProps, "type" | "className">) {
  const { t } = useLocale()
  const [shown, setShown] = useState(false)
  const Toggle = shown ? EyeOff : Eye
  return (
    <Field id={id} label={label} error={error}>
      <Lock aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" />
      <input id={id} type={shown ? "text" : "password"} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hintId)} className="fs-control pl-11 pr-12" {...rest} />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={`${shown ? t.auth.hidePassword : t.auth.showPassword}: ${label}`}
        aria-controls={id}
        className="absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 transition-colors hover:text-ink focus-visible:rounded-lg"
      >
        <Toggle aria-hidden className="size-[18px]" />
      </button>
    </Field>
  )
}

export function PasswordRules({ id, password }: { id: string; password: string }) {
  const { t } = useLocale()
  const checks = passwordChecks(password)
  const rules = [[t.auth.ruleLength, checks.length], [t.auth.ruleMix, checks.mix]] as const
  return (
    <ul id={id} aria-live="polite" className="mt-2 space-y-1 text-[13px] leading-5">
      {rules.map(([label, met]) => (
        <li key={label} className={`flex items-start gap-1.5 transition-colors ${met ? "text-good" : "text-ink-3"}`}>
          <span aria-hidden className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-current ${met ? "" : "border-dashed"}`}>
            {met && <Check className="fs-pop size-2.5" strokeWidth={3.5} />}
          </span>
          <span className="min-w-0">{label}<span className="sr-only"> ({met ? t.auth.ruleMet : t.auth.ruleNotMet})</span></span>
        </li>
      ))}
    </ul>
  )
}

const NOTICE = {
  bad: { icon: CircleAlert, className: "border-bad text-bad fs-tint-bad" },
  good: { icon: CircleCheck, className: "border-good text-good fs-tint-good" },
  info: { icon: Info, className: "border-line-strong text-ink-2 bg-surface" },
}

export function Notice({ tone, children }: { tone: keyof typeof NOTICE; children: React.ReactNode }) {
  const { icon: Icon, className } = NOTICE[tone]
  return (
    <p className={`fs-fade flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium leading-5 ${className}`}>
      <Icon aria-hidden className="mt-px size-[18px] shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </p>
  )
}

export function LiveError({ message }: { message: React.ReactNode }) {
  return <div role="alert">{message && <Notice tone="bad">{message}</Notice>}</div>
}

type SubmitProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { busy: boolean; busyLabel: string; variant?: "primary" | "outline" }

export function SubmitButton({ busy, busyLabel, children, variant = "primary", type = "submit", disabled, ...rest }: SubmitProps) {
  // Keeps focus in the field on press: a blur error would move the button before the click lands.
  const holdFocus = type === "submit" ? (event: React.MouseEvent) => event.preventDefault() : undefined
  return (
    <button type={type} aria-busy={busy || undefined} disabled={busy || disabled} onMouseDown={holdFocus} className={authButton[variant]} {...rest}>
      {busy && <LoaderCircle aria-hidden className="size-[18px] animate-spin" />}
      {busy ? busyLabel : children}
    </button>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px] shrink-0">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.77-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.23 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

export function GoogleButton({ busy, disabled, onClick, label }: { busy: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} className={authButton.outline}>
      {busy ? <LoaderCircle aria-hidden className="size-[18px] animate-spin" /> : <GoogleMark />}
      {label}
    </button>
  )
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div aria-hidden className="my-4 flex items-center gap-3 text-[13px] text-ink-3">
      <span className="h-px flex-1 bg-line" />{label}<span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function PlanChip({ plan, interval }: { plan: PaidPlanId; interval: BillingInterval }) {
  const { locale, t } = useLocale()
  const { name, monthlyPriceUsd, annualPriceUsd } = PLANS[plan]
  const annual = interval === "annual"
  const price = new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(annual ? annualPriceUsd : monthlyPriceUsd)
  return (
    <div className="fs-fade fs-tint-hot mt-4 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-ink-2">{t.auth.planNote}</p>
        <p className="truncate font-semibold text-ink">{name} <span className="font-normal text-ink-2">· {annual ? t.pricing.annual : t.pricing.monthly}</span></p>
      </div>
      <p className="tabular shrink-0 text-sm font-semibold text-ink">{price}{annual ? t.pricing.perYear : t.pricing.perMonth}</p>
    </div>
  )
}

function LanguageAnchor({ query = "" }: { query?: string }) {
  const { locale, t } = useLocale()
  const other = locale === "en" ? "fr" : "en"
  const path = (usePathname() ?? "/signin").replace(/^\/(?:fr|en)(?=\/|$)/, "") || "/"
  return (
    <Link
      href={`${localePath(other, path)}${query}`}
      hrefLang={other}
      lang={other}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink focus-visible:rounded-lg"
    >
      <Languages aria-hidden className="size-4" />
      {t.nav.language}
    </Link>
  )
}

function LanguageWithQuery() {
  const query = useSearchParams()?.toString()
  return <LanguageAnchor query={query ? `?${query}` : ""} />
}

export function LanguageLink() {
  return (
    <Suspense fallback={<LanguageAnchor />}>
      <LanguageWithQuery />
    </Suspense>
  )
}

export function FormSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="fs-skeleton h-9 w-3/5" />
      <div className="fs-skeleton h-12" />
      <div className="fs-skeleton h-12" />
      <div className="fs-skeleton h-12" />
    </div>
  )
}
