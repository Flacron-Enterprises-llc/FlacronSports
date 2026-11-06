import type { Metadata } from "next"
import { PaymentStatus } from "@/components/account/payment-status"

export const metadata: Metadata = { title: "Payment", robots: { index: false } }

export default function Page() {
  return (
    <main id="main" className="relative flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div aria-hidden className="fs-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]" />
      <div className="relative w-full">
        <PaymentStatus />
      </div>
    </main>
  )
}
