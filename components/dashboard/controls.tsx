"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, RefreshCw, WifiOff } from "lucide-react"
import { btn, Notice } from "@/components/site/states"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

export function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}

export function OfflineBanner() {
  const { t } = useLocale()
  const online = useOnline()
  if (online) return null
  return (
    <p role="status" className="fs-tone-warn flex items-center gap-2 border-b px-4 py-2 text-sm text-ink sm:px-6 lg:px-10">
      <WifiOff aria-hidden className="size-4 shrink-0 text-warn" />
      {t.ui.offline}
    </p>
  )
}

/** Re-runs the server render of the current route unless given its own action. */
export function RetryButton({ label, onRetry }: { label?: string; onRetry?: () => void }) {
  const { t } = useLocale()
  const router = useRouter()
  return (
    <button type="button" onClick={onRetry ?? (() => router.refresh())} className={btn("outline", "sm")}>
      <RefreshCw aria-hidden className="size-3.5" /> {label ?? t.common.retry}
    </button>
  )
}

export function ErrorNotice({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return <Notice tone="danger" role="alert" action={<RetryButton onRetry={onRetry} />}>{children}</Notice>
}

/** Keeps live scores current while the tab is visible. Off in low-data mode. */
export function AutoRefresh({ enabled, seconds = 60 }: { enabled: boolean; seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh()
    }, seconds * 1000)
    return () => clearInterval(timer)
  }, [enabled, seconds, router])
  return null
}

export function Switch({ checked, onChange, label, labelledBy, disabled }: { checked: boolean; onChange(value: boolean): void; label?: string; labelledBy?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 [transition-timing-function:var(--ease)] disabled:opacity-50", checked ? "border-transparent bg-good" : "border-line-strong bg-surface-muted")}
    >
      <span aria-hidden className={cn("inline-block size-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 [transition-timing-function:var(--ease)]", checked ? "translate-x-[22px]" : "translate-x-[3px]")} />
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange(value: T): void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1 rounded-lg border border-line bg-surface-muted p-1">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors", value === option.value ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export interface TabItem<T extends string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  count?: number
}

/** WAI-ARIA tabs with arrow-key movement. The parent owns the value. */
export function Tabs<T extends string>({ value, onChange, tabs, label, children }: { value: T; onChange(value: T): void; tabs: TabItem<T>[]; label: string; children: React.ReactNode }) {
  const id = useId()
  const list = useRef<HTMLDivElement>(null)
  const onKey = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.value === value)
    const next = ({ ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 } as Record<string, number>)[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(tabs[next].value)
    list.current?.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next].value}"]`)?.focus()
  }
  return (
    <div>
      <div ref={list} role="tablist" aria-label={label} onKeyDown={onKey} className="fs-noscrollbar flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const on = tab.value === value
          return (
            <button key={tab.value} data-tab={tab.value} id={`${id}-${tab.value}`} type="button" role="tab" aria-selected={on} aria-controls={`${id}-panel`} tabIndex={on ? 0 : -1} onClick={() => onChange(tab.value)} className={cn("relative -mb-px inline-flex items-center gap-2 whitespace-nowrap px-3.5 pb-3 pt-2 text-sm font-medium transition-colors", on ? "text-ink" : "text-ink-2 hover:text-ink")}>
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && <span className={cn("tabular rounded-full px-1.5 py-px text-[11px] font-semibold", on ? "fs-chip-hot" : "bg-surface-muted text-ink-2")}>{tab.count}</span>}
              <span aria-hidden className={cn("absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-orange transition-transform duration-300 [transition-timing-function:var(--ease)]", on ? "scale-x-100" : "scale-x-0")} />
            </button>
          )
        })}
      </div>
      <div key={value} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} tabIndex={0} className="fs-panel-in pt-5 focus-visible:outline-none">{children}</div>
    </div>
  )
}

/** A promise-based replacement for window.confirm, in the page's language and theme. */
export function useConfirm() {
  const { t } = useLocale()
  const [ask, setAsk] = useState<{ message: string; danger: boolean; resolve(value: boolean): void } | null>(null)
  const confirm = useCallback((message: string, danger = false) => new Promise<boolean>((resolve) => setAsk({ message, danger, resolve })), [])
  const settle = (value: boolean) => {
    ask?.resolve(value)
    setAsk(null)
  }
  const dialog = (
    <AlertDialog open={ask !== null} onOpenChange={(open) => { if (!open) settle(false) }}>
      <AlertDialogContent className="border-line bg-surface-raised">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-ink">{t.ui.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-ink-2">{ask?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)} className={btn("outline")}>{t.ui.keep}</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)} className={btn(ask?.danger ? "danger" : "navy")}>{t.ui.continue}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  return { confirm, dialog }
}

export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => undefined)
  return (
    <button type="button" onClick={copy} className={btn("outline", "sm")}>
      {copied ? <Check aria-hidden className="size-3.5 text-good" /> : <Copy aria-hidden className="size-3.5" />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  )
}

/** Closes on outside press and Escape, and returns focus to the trigger. */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  return { open, setOpen, box, trigger }
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!active) return
    const previous = document.activeElement as HTMLElement | null
    const element = ref.current
    element?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return close.current()
      if (event.key !== "Tab" || !element) return
      const items = Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) return event.preventDefault()
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [active, ref])
}
