import Link from "next/link"
import { ArrowRight, Check, ChevronRight } from "lucide-react"
import { buttonClass } from "./button"

export const reveal = (index: number) => ({ ["--reveal-i" as string]: index }) as React.CSSProperties
export const rise = (index: number) => ({ ["--i" as string]: index }) as React.CSSProperties

export function CheckList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[15px] leading-6 text-ink-2">
          <span className="fs-tint-good mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-good">
            <Check aria-hidden className="size-3" strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

export function StatusBadge({ soon, children }: { soon?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${soon ? "fs-chip-warn" : "fs-chip-good"}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

/** Public page hero: breadcrumb, the page's single h1, a lead and optional actions. */
export function PageHeader({
  title,
  lead,
  crumbs,
  actions,
  className = "",
}: {
  title: string
  lead?: string
  crumbs: [name: string, href: string][]
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={`relative max-w-3xl ${className}`}>
      <nav aria-label="Breadcrumb" className="fs-rise">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
          {crumbs.map(([name, to], index) => (
            <li key={to} className="inline-flex items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden className="size-3" />}
              {index === crumbs.length - 1 ? (
                <span aria-current="page" className="text-ink-2">{name}</span>
              ) : (
                <Link href={to} className="fs-link hover:text-ink">{name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="fs-rise mt-5 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.6rem]" style={rise(1)}>{title}</h1>
      {lead && <p className="fs-rise mt-5 max-w-2xl text-[17px] leading-8 text-ink-2" style={rise(2)}>{lead}</p>}
      {actions && <div className="fs-rise mt-8 flex flex-wrap gap-3" style={rise(3)}>{actions}</div>}
    </header>
  )
}

/** Closing call-to-action band used across public pages. */
export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: string
  body: string
  primary: { href: string; label: string }
  secondary: { href: string; label: string }
}) {
  return (
    <section aria-labelledby="cta-band" className="mx-auto mt-28 max-w-7xl px-4 sm:px-6">
      <div data-reveal className="fs-band relative overflow-hidden rounded-3xl px-6 py-14 sm:px-12 lg:py-16">
        <div aria-hidden className="fs-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 hidden size-[420px] sm:block">
          <div className="fs-rings absolute inset-0" />
          <div className="fs-radar absolute inset-[10%] opacity-70" />
        </div>
        <div className="relative max-w-2xl">
          <h2 id="cta-band" className="text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.3rem]">{title}</h2>
          <p className="mt-4 text-[16.5px] leading-7 text-white/75">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={primary.href} className={buttonClass("primary", "lg")}>
              {primary.label} <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href={secondary.href} className={buttonClass("inverse-outline", "lg")}>{secondary.label}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
