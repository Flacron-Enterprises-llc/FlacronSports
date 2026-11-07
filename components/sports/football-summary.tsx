import { Panel } from "@/components/site/states"
import type { Dictionary } from "@/lib/i18n"
import { SpoilerGuard } from "./parts"

/** The source writes this in English and it often states the result. Other locales leave it out. */
export function FootballSummary({ text, t }: { text: string; t: Dictionary }) {
  return (
    <Panel>
      <SpoilerGuard label={t.spoiler.revealResult}>
        <p className="text-sm leading-6 text-ink">{text}</p>
      </SpoilerGuard>
    </Panel>
  )
}
