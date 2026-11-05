import { Bell, CalendarDays, FileText, MessageCircleQuestion, MonitorPlay, Trophy, Users, type LucideIcon } from "lucide-react"
import type { IconKey } from "@/lib/marketing"

const ICONS: Record<IconKey, LucideIcon> = {
  scores: CalendarDays,
  match: Trophy,
  watch: MonitorPlay,
  teams: Bell,
  reports: FileText,
  assistant: MessageCircleQuestion,
  community: Users,
}

export function FeatureIcon({ k, className = "size-5" }: { k: IconKey; className?: string }) {
  const Icon = ICONS[k]
  return <Icon className={className} aria-hidden />
}
