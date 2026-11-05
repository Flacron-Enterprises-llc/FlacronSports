"use client"

import { Moon, Sun } from "lucide-react"
import { useLocale } from "@/lib/use-locale"

export function ThemeToggle() {
  const { t } = useLocale()
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("fs-theme", next)
    } catch {
      /* storage unavailable */
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.nav.theme}
      className="inline-flex size-10 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <Sun aria-hidden className="hidden size-[18px] dark:block" />
      <Moon aria-hidden className="size-[18px] dark:hidden" />
    </button>
  )
}
