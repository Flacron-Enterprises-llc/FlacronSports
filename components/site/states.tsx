import Link from "next/link"

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-6 text-ink-2">{body}</p>
      {action && (
        <Link href={action.href} className="mt-5 inline-block rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="pb-8 pt-10">
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl leading-7 text-ink-2">{lead}</p>}
    </header>
  )
}
