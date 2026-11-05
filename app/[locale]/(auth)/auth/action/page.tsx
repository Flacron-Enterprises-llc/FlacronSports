import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthAction } from "@/components/auth/auth-action"

export const metadata: Metadata = { title: "Account action", robots: { index: false } }

export default function Page() {
  return (
    <Suspense>
      <AuthAction />
    </Suspense>
  )
}
