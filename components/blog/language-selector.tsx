"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe } from "lucide-react"

interface LanguageSelectorProps {
  currentLanguage: string
  availableLanguages: string[]
  slug: string
}

export function LanguageSelector({ currentLanguage, availableLanguages, slug }: LanguageSelectorProps) {
  const router = useRouter()
  const allLanguages = ["en", ...availableLanguages.filter((lang) => lang !== "en")]

  const languageNames: Record<string, string> = {
    en: "English",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    it: "Italiano",
  }

  const handleLanguageChange = (language: string) => {
    router.push(`/blog/${slug}?lang=${language}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-500" />
      <Select value={currentLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allLanguages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {languageNames[lang] || lang.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
