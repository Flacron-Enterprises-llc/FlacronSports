import { Suspense } from "react"
import type { Metadata } from "next"
import { FormSkeleton } from "@/components/auth/auth-ui"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = { title: "Create your account", robots: { index: false } }

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <AuthForm mode="signup" />
    </Suspense>
  )
}
