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
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], size === "sm" ? "min-h-10 px-3 text-[13px] sm:min-h-9" : "min-h-10 px-4 text-sm", className)
}

const PAGE_WIDTH = { lg: "max-w-[1360px]", xl: "max-w-6xl", md: "max-w-5xl", sm: "max-w-3xl" }

export function AppPage({ children, width = "lg", className }: { children: React.ReactNode; width?: keyof typeof PAGE_WIDTH; className?: string }) {
  return <main id="main" className={cn("mx-auto w-full min-w-0 px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-8", PAGE_WIDTH[width], className)}>{children}</main>
}

/** One look for every filter, tab or sport chip in the dashboard. 40 px on a phone. */
export function chipClass(active: boolean, className?: string) {
  return cn(
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors sm:min-h-9",
    active ? "border-navy bg-navy text-white dark:border-brand dark:bg-brand dark:text-brand-on" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
    className,
  )
}

export function PageHeader({ title, lead, icon, actions, className }: { title: string; lead?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("fs-rise mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white dark:bg-surface-muted dark:text-brand sm:inline-flex [&_svg]:size-[22px]">{icon}</span>}
        <div className="min-w-0">
          <h1 className="break-words text-[1.625rem] font-semibold leading-tight text-ink sm:text-[1.875rem]">{title}</h1>
          {lead && <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-2">{lead}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** `flush` hands the body to rows or tables that run edge to edge. */
export function Panel({ title, description, icon, actions, children, className, id, flush }: { title?: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string; flush?: boolean }) {
  const head = title || actions
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]", !flush && "p-4 sm:p-5", className)}>
      {head && (
        <div className={cn("flex flex-wrap justify-between gap-x-3 gap-y-2", description ? "items-start" : "items-center", flush ? "border-b border-line px-4 py-3 sm:px-5" : "mb-4")}>
          <div className={cn("flex min-w-0 gap-2.5", description ? "items-start" : "items-center")}>
            {icon && <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand [&_svg]:size-4">{icon}</span>}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold leading-6 text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** A heading for a block of cards that has no panel of its own. */
export function SectionHeading({ title, icon, action, live, className }: { title: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; live?: boolean; className?: string }) {
  return (
    <div className={cn("flex min-h-8 items-center justify-between gap-4", className)}>
      <h2 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold text-ink [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-brand">
        {live && <span aria-hidden className="fs-live-dot size-2 shrink-0 rounded-full bg-live" />}
        {icon}
        <span className="min-w-0 truncate">{title}</span>
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()

/** A person in a chat or member list. Decorative, because their name sits beside it. */
export function Initials({ name, mine, className }: { name: string; mine?: boolean; className?: string }) {
  return <span aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-semibold", mine ? "fs-chat-user" : "bg-surface-muted text-ink-2", className)}>{initials(name)}</span>
}

/** A place in a ranked list. First place is the only one that takes the accent. */
export function RankBadge({ rank }: { rank: number }) {
  return <span className={cn("tabular inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold", rank === 1 ? "fs-chip-hot" : rank <= 3 ? "bg-surface-muted text-ink" : "text-ink-2")}>{rank}</span>
}

export interface FactItem {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
}

/** Labelled values, for match, event and player facts. */
export function FactGrid({ facts, className }: { facts: FactItem[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-3.5 text-sm", className)}>
      {facts.map((fact, index) => (
        <div key={index} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[13px] text-ink-2 [&_svg]:size-3.5 [&_svg]:shrink-0">{fact.icon}{fact.label}</dt>
          <dd className="mt-0.5 break-words font-medium text-ink">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** `band` sits on the navy hero, where a tile would be a box inside a box. */
export function StatTile({ label, value, hint, icon, href, tone, band }: { label: string; value: number | null; hint?: string; icon: React.ReactNode; href?: string; tone?: "live"; band?: boolean }) {
  const live = tone === "live" && Boolean(value)
  const body = band ? (
    <>
      <span className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-white/75 [&_svg]:size-3.5 [&_svg]:shrink-0">
        {live ? <span aria-hidden className="fs-live-dot size-2 shrink-0 rounded-full bg-[#ff6b7f]" /> : icon}
        <span className="min-w-0 leading-tight">{label}</span>
      </span>
      <span className="fs-score mt-1.5 block text-[1.75rem] font-semibold text-white sm:text-[2rem]">{value === null ? <span aria-hidden>–</span> : <CountUp value={value} />}</span>
    </>
  ) : (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[13px] font-medium leading-5 text-ink-2">{label}</span>
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]", live ? "fs-chip-live" : "bg-surface-muted text-brand")}>{icon}</span>
      </span>
      <span className="mt-1 block font-display text-[1.75rem] font-semibold leading-none text-ink">{value === null ? <span aria-hidden>–</span> : <CountUp value={value} />}</span>
      {hint && <span className="mt-2 block truncate text-xs text-ink-3">{hint}</span>}
    </>
  )
  const shared = band
    ? "block min-w-0 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10"
    : "fs-lift block min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5"
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
    <div role={role} className={cn("flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm", surface, className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", color)} />
      <div className="min-w-[12rem] flex-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cn("leading-6 text-ink-2", title ? "mt-0.5" : "")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

/** `inline` lays it out as one row, for a page that has more to show below it. */
export function EmptyState({ title, body, action, icon, compact, inline, children, className }: { title: string; body?: React.ReactNode; action?: { href: string; label: string }; icon?: React.ReactNode; compact?: boolean; inline?: boolean; children?: React.ReactNode; className?: string }) {
  if (inline) {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)]", className)}>
        {icon && <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand [&_svg]:size-5">{icon}</span>}
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-[15px] font-semibold leading-6 text-ink">{title}</h2>
          {body && <p className="text-[13px] leading-5 text-ink-2">{body}</p>}
        </div>
        {action && <Link href={action.href} className={btn("navy", "sm")}>{action.label}</Link>}
        {children}
      </div>
    )
  }
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-line bg-surface text-center shadow-[var(--shadow-sm)]", compact ? "px-5 py-7" : "px-6 py-12", className)}>
      <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]" />
      <div className="relative mx-auto max-w-md">
        {icon && <span className="mx-auto mb-3.5 inline-flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-brand [&_svg]:size-[22px]">{icon}</span>}
        <h2 className={cn("font-semibold text-ink", compact ? "text-[15px]" : "text-lg")}>{title}</h2>
        {body && <p className="mt-1 text-sm leading-6 text-ink-2">{body}</p>}
        {action && <Link href={action.href} className={btn("navy", "md", "mt-4")}>{action.label}</Link>}
        {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
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
  return <Skeleton className="h-44 w-full rounded-2xl sm:h-40" />
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-14 rounded-full" /></div>
          <div className="mt-4 flex items-center gap-2.5"><Skeleton className="size-7 shrink-0 rounded-full" /><Skeleton className="h-4 w-5/6" /></div>
          <div className="mt-2.5 flex items-center gap-2.5"><Skeleton className="size-7 shrink-0 rounded-full" /><Skeleton className="h-4 w-2/3" /></div>
        </div>
      ))}
    </div>
  )
}

/** The shape of competition groups, for the scores page. */
export function RowGroupSkeleton({ groups = 2, rows = 4 }: { groups?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: groups }, (_, group) => (
        <div key={group} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3"><Skeleton className="size-4 rounded" /><Skeleton className="h-4 w-40" /></div>
          <div className="fs-rows fs-rows-2">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-12 shrink-0" />
                <div className="flex-1 space-y-2.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function VideoGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-line bg-surface">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2 p-3"><Skeleton className="h-4 w-5/6" /><Skeleton className="h-3 w-1/2" /></div>
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
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-5 h-4 w-24" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}
