import type { Metadata } from "next"
import { VerifyEmail } from "@/components/auth/verify-email"

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } }

export default function Page() {
  return <VerifyEmail />
}
