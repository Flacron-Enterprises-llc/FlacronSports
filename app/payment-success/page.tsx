"use client";
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!searchParams) return

      const paymentIntent = searchParams.get("payment_intent")
      const paymentIntentClientSecret = searchParams.get("payment_intent_client_secret")
      const redirectStatus = searchParams.get("redirect_status")

      if (redirectStatus === "succeeded") {
        try {
          // Here you would typically update your database to mark the user as premium
          // For example:
          // await fetch('/api/update-subscription-status', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ 
          //     paymentIntent,
          //     status: 'active'
          //   })
          // })

          toast.success("Payment successful! Welcome to premium!")
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push("/dashboard")
          }, 2000)
        } catch (error) {
          toast.error("Failed to update subscription status")
          router.push("/dashboard")
        }
      } else {
        toast.error("Payment failed. Please try again.")
        router.push("/dashboard")
      }
      setIsLoading(false)
    }

    checkPaymentStatus()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {isLoading ? "Processing Payment" : "Payment Complete"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLoading
              ? "Please wait while we confirm your payment..."
              : "Redirecting you to the dashboard..."}
          </p>
        </div>
      </div>
    </div>
  )
} 