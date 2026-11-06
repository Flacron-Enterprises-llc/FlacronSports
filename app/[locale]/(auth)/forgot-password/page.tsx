import { Suspense } from "react"
import type { Metadata } from "next"
import { FormSkeleton } from "@/components/auth/auth-ui"
import { ForgotPassword } from "@/components/auth/forgot-password"

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } }

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ForgotPassword />
    </Suspense>
  )
}
