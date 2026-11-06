import Link from "next/link"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { CountUp } from "@/components/site/motion"
import { cn } from "@/lib/utils"

type ButtonVariant = "primary" | "navy" | "outline" | "ghost" | "danger"

const BUTTON_BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 [transition-timing-function:var(--ease)] active:translate-y-px disabled:pointer-events-none disabled:opacity-55"
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-orange text-hot-on shadow-[var(--shadow-sm)] hover:bg-orange-hover",
  navy: "bg-navy text-white shadow-[var(--shadow-sm)] hover:bg-navy-deep dark:bg-brand dark:text-brand-on dark:hover:opacity-90",
  outline: "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-ink-2 hover:bg-surface-muted hover:text-ink",
  danger: "border border-bad bg-surface text-bad hover:bg-surface-muted",
}

export function btn(variant: ButtonVariant = "navy", size: "sm" | "md" = "md", className?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-10 px-4 text-sm", className)
}

const PAGE_WIDTH = { lg: "max-w-[1360px]", md: "max-w-5xl", sm: "max-w-3xl" }

export function AppPage({ children, width = "lg", className }: { children: React.ReactNode; width?: keyof typeof PAGE_WIDTH; className?: string }) {
  return <main id="main" className={cn("mx-auto w-full min-w-0 px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pt-8", PAGE_WIDTH[width], className)}>{children}</main>
}

export function PageHeader({ title, lead, icon, actions, className }: { title: string; lead?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("fs-rise mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        {icon && <span className="mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white shadow-[var(--shadow-sm)] dark:bg-surface-muted dark:text-brand sm:inline-flex [&_svg]:size-5">{icon}</span>}
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">{title}</h1>
          {lead && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-2 sm:text-[15px]">{lead}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({ title, description, icon, actions, children, className, id }: { title?: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-24 rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)] sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand [&_svg]:size-4">{icon}</span>}
            <div className="min-w-0">
              {title && <h2 className="text-[15.5px] font-semibold leading-6 text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm leading-6 text-ink-2">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatTile({ label, value, hint, icon, href, tone }: { label: string; value: number | null; hint?: string; icon: React.ReactNode; href?: string; tone?: "live" }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[13px] font-medium leading-5 text-ink-2">{label}</span>
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]", tone === "live" && value ? "fs-chip-live" : "bg-surface-muted text-brand")}>{icon}</span>
      </span>
      <span className="mt-1 block font-display text-[1.75rem] font-semibold leading-none text-ink">{value === null ? <span aria-hidden>–</span> : <CountUp value={value} />}</span>
      {hint && <span className="mt-2 block truncate text-xs text-ink-3">{hint}</span>}
    </>
  )
  const shared = "fs-lift block min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5"
  return href ? <Link href={href} className={shared}>{body}</Link> : <div className={shared}>{body}</div>
}

const NOTICE = {
  info: ["fs-tone-info", "text-[var(--info)]", Info],
  warning: ["fs-tone-warn", "text-warn", TriangleAlert],
  danger: ["fs-tone-bad", "text-bad", CircleAlert],
  success: ["fs-tone-good", "text-good", CircleCheck],
} as const

export function Notice({ tone = "info", title, children, action, role, className }: { tone?: keyof typeof NOTICE; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; role?: "status" | "alert" | "note"; className?: string }) {
  const [surface, color, Icon] = NOTICE[tone]
  return (
    <div role={role} className={cn("flex flex-wrap items-start gap-3 rounded-xl border p-3.5 text-sm", surface, className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", color)} />
      <div className="min-w-[12rem] flex-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cn("leading-6 text-ink-2", title ? "mt-0.5" : "")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

export function EmptyState({ title, body, action, icon, compact, children, className }: { title: string; body?: React.ReactNode; action?: { href: string; label: string }; icon?: React.ReactNode; compact?: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface text-center", compact ? "px-5 py-8" : "px-6 py-12", className)}>
      <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]" />
      <div className="relative mx-auto max-w-md">
        {icon && <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-brand shadow-[var(--shadow-sm)] [&_svg]:size-5">{icon}</span>}
        <h2 className={cn("font-semibold text-ink", compact ? "text-base" : "text-lg")}>{title}</h2>
        {body && <p className="mt-1.5 text-sm leading-6 text-ink-2">{body}</p>}
        {action && <Link href={action.href} className={btn("navy", "md", "mt-5")}>{action.label}</Link>}
        {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

export function Meter({ value, max, label, tone = "default", className }: { value: number; max: number; label: string; tone?: "default" | "inverse"; className?: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 100
  const color = percent >= 100 ? "bg-bad" : percent >= 80 ? "bg-warn" : tone === "inverse" ? "bg-orange" : "bg-[var(--fs-blue)]"
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} className={cn("h-1.5 overflow-hidden rounded-full", tone === "inverse" ? "bg-white/15" : "bg-surface-muted", className)}>
      <div className={cn("fs-meter-fill h-full rounded-full", color)} style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("fs-skeleton block", className)} />
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-14" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-14 rounded-full" /></div>
          <Skeleton className="mt-5 h-5 w-5/6" />
          <Skeleton className="mt-3 h-5 w-2/3" />
          <Skeleton className="mt-5 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
    </div>
  )
}
