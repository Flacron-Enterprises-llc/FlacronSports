import type { Metadata } from "next"
import { AdminGate } from "@/components/admin/admin-gate"
import { PageHeader } from "@/components/site/states"

export const metadata: Metadata = { title: "Admin", robots: { index: false } }

export default function AdminPage() {
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader title="Admin" />
      <AdminGate />
    </main>
  )
}
