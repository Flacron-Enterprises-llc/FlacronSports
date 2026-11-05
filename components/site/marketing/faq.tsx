import Link from "next/link"

type Faqs = readonly (readonly [string, string])[]

/** Accessible accordion on native details, so it needs no client JS. */
export function FaqList({ faqs, itemHeading = "h3" }: { faqs: Faqs; itemHeading?: "h2" | "h3" }) {
  const Heading = itemHeading
  return (
    <div className="w-full divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]">
      {faqs.map(([question, answer]) => (
        <details key={question} className="group px-4 py-4 transition-colors open:bg-surface-muted sm:px-6 sm:py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md">
            <Heading className="min-w-0 flex-1 font-sans text-[15px] font-semibold leading-6 text-ink [text-wrap:pretty] sm:text-base">{question}</Heading>
            <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform duration-300 group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-[75ch] text-[15px] leading-7 text-ink-2">{answer}</p>
        </details>
      ))}
    </div>
  )
}

export function FaqSection({
  id,
  title,
  intro,
  faqs,
  more,
  className = "mt-24",
}: {
  id: string
  title: string
  intro?: string
  faqs: Faqs
  more: { before: string; label: string; href: string }
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id={id} data-reveal className="text-[1.6rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]">{title}</h2>
          {intro && <p className="mt-3 text-[15px] leading-7 text-ink-2">{intro}</p>}
          <p className="mt-4 text-sm text-ink-3">
            {more.before}{" "}
            <Link href={more.href} className="font-medium text-hot-text underline-offset-4 hover:underline">{more.label}</Link>.
          </p>
        </div>
        <FaqList faqs={faqs} />
      </div>
    </section>
  )
}
