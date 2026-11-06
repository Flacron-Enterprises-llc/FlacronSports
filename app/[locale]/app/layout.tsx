import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell community={process.env.COMMUNITY_ENABLED === "true"}>{children}</AppShell>
}
