import { Suspense } from "react"
import type { Metadata } from "next"
import { FormSkeleton } from "@/components/auth/auth-ui"
import { VerifyEmail } from "@/components/auth/verify-email"

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } }

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <VerifyEmail />
    </Suspense>
  )
}
