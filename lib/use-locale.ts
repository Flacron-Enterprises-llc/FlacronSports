"use client"

import { useParams } from "next/navigation"
import { getDictionary, isLocale, localePath, type Locale } from "@/lib/i18n"

export function useLocale() {
  const param = useParams()?.locale
  const locale: Locale = typeof param === "string" && isLocale(param) ? param : "en"
  return { locale, t: getDictionary(locale), href: (path: string) => localePath(locale, path) }
}
