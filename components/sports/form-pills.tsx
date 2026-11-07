import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const CODES = { W: "win", D: "draw", L: "loss" } as const
const TONE = { win: "fs-form-win", draw: "fs-form-draw", loss: "fs-form-loss" }

/** A table's form as the feed writes it, such as "WWDLW". Any other letter is left out. */
export function FormPills({ form, t }: { form: string; t: Dictionary }) {
  const results = [...form.toUpperCase()].flatMap((code) => (code in CODES ? [CODES[code as keyof typeof CODES]] : []))
  if (results.length === 0) return <span>{form}</span>
  return (
    <span className="inline-flex gap-0.5">
      <span className="sr-only">{results.map((result) => t.discover.formNames[result]).join(", ")}</span>
      {results.map((result, index) => <span key={index} aria-hidden className={cn("inline-flex size-[1.375rem] items-center justify-center rounded-md text-[11px] font-bold", TONE[result])}>{t.discover.formLetters[result]}</span>)}
    </span>
  )
}
