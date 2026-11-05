import type { Metadata } from "next"
import { PaymentStatus } from "@/components/account/payment-status"

export const metadata: Metadata = { title: "Payment", robots: { index: false } }

export default function Page() {
  return (
    <main id="main" className="px-4 py-16">
      <PaymentStatus />
    </main>
  )
}
