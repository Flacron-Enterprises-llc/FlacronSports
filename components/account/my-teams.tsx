"use client"

import Link from "next/link"
import { useFavorites } from "@/components/sports/parts"
import { EmptyState } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"

export function MyTeams() {
  const { t, href } = useLocale()
  const { names, toggle } = useFavorites()

  if (names.length === 0) {
    return <EmptyState title={t.myTeams.empty} body={t.myTeams.emptyBody} action={{ href: href("/scores"), label: t.myTeams.browse }} />
  }

  return (
    <section aria-label={t.myTeams.following}>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {names.map((name) => (
          <li key={name} className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href={href(`/scores?q=${encodeURIComponent(name)}`)} className="font-medium text-ink hover:underline">{name}</Link>
            <button type="button" onClick={() => toggle(name)} className="text-sm font-medium text-ink-2 hover:text-ink">
              {t.myTeams.remove}<span className="sr-only">: {name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
