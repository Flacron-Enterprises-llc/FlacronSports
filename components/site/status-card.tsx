import type { LucideIcon } from "lucide-react"

const TONES = { brand: "text-brand", hot: "text-hot-text", good: "text-good", warn: "text-warn", bad: "text-bad" }

export function IconBadge({ icon: Icon, tone = "brand", className = "" }: { icon: LucideIcon; tone?: keyof typeof TONES; className?: string }) {
  return (
    <span className={`fs-pop inline-flex size-14 items-center justify-center rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)] ${TONES[tone]} ${className}`}>
      <Icon aria-hidden className="size-7" />
    </span>
  )
}

export function AnimatedCheck({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`fs-success ${className}`}>
      <svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative size-full">
        <circle cx="26" cy="26" r="21" pathLength={1} />
        <path d="m17 27 6.5 6.5L35.5 20" pathLength={1} />
      </svg>
    </span>
  )
}

/** Centered confirmation card shared by payment, not-found and error pages. */
export function StatusCard({ visual, title, body, children }: { visual: React.ReactNode; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="fs-rise w-full max-w-[420px] rounded-2xl border border-line bg-surface p-7 text-center shadow-[var(--shadow-md)] sm:p-9">
      <div className="flex justify-center">{visual}</div>
      <h1 className="mt-5 text-[1.6rem] font-semibold leading-tight text-ink">{title}</h1>
      {body && <p className="mt-2 text-[15px] leading-6 text-ink-2">{body}</p>}
      {children && <div className="mt-6 space-y-2.5">{children}</div>}
    </div>
  )
}
