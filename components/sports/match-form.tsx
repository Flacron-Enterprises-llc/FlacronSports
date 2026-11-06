import { Panel, Skeleton } from "@/components/site/states"
import type { Dictionary } from "@/lib/i18n"
import { teamForm, type FormResult } from "@/lib/sports/detail"
import { getTeamFixtures } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { SpoilerGuard } from "./parts"

const TONE: Record<FormResult, string> = { win: "fs-tone-good text-good", draw: "bg-surface-muted text-ink-2", loss: "fs-tone-bad text-bad" }

export function MatchFormSkeleton() {
  return <Panel><div className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div></Panel>
}

/** Streams in after the page, so slow team lookups never hold up the score. */
export async function MatchForm({ event, t }: { event: SportEvent; t: Dictionary }) {
  const lookups = await Promise.all(event.participants.map(async ({ name }) => {
    const fixtures = await getTeamFixtures(name, event.sportId)
    return { name, failed: fixtures.feed.state === "unavailable", form: teamForm(fixtures.recent, name, event) }
  }))
  const rows = lookups.filter((row) => row.form.length > 0)
  if (rows.length === 0) {
    if (!lookups.some((row) => row.failed)) return null
    return <Panel title={t.match.form}><p className="text-sm leading-6 text-ink-2">{t.match.formFailed}</p></Panel>
  }

  return (
    <Panel title={t.match.form} description={t.match.formLatest}>
      <SpoilerGuard label={t.spoiler.revealResult}>
        <ul className="space-y-2">
          {rows.map(({ name, form }) => (
            <li key={name} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink">{name}</span>
              <span className="flex gap-1">
                {form.map((result, index) => (
                  <span key={index} className={cn("inline-flex size-6 items-center justify-center rounded-md border border-transparent text-[11px] font-semibold", TONE[result])}>
                    <span aria-hidden>{t.match.formLetters[result]}</span>
                    <span className="sr-only">{t.match.formNames[result]}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </SpoilerGuard>
    </Panel>
  )
}
