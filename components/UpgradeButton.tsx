"use client"
import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { API_CONFIG } from "@/lib/api-config"
import StripePaymentForm from "./StripePaymentForm"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { useAuthUser } from "@/lib/hooks/useAuthUser"

const stripePromise = loadStripe(API_CONFIG.payments.stripe.publishableKey)

interface UpgradeButtonProps {
  customerId: string
}

export default function UpgradeButton({ customerId }: UpgradeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const user = useAuthUser();

  const handleUpgrade = async () => {
    try {
      setIsLoading(true)
      console.log("Starting subscription creation...")
      
      const response = await fetch("/api/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: customerId,
          email: user?.email || undefined,
        }),
      })

      const data = await response.json()
      console.log("Subscription API response:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to create subscription")
      }

      if (!data.clientSecret) {
        throw new Error("No client secret received from the server")
      }

      console.log("Setting client secret and opening payment form...")
      setClientSecret(data.clientSecret)
      setIsOpen(true)
    } catch (error) {
      console.error("Error starting subscription:", error)
      toast.error("Failed to start subscription process")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuccess = () => {
    setIsOpen(false)
    toast.success("Successfully subscribed to premium!")
  }

  const handleCancel = () => {
    setIsOpen(false)
    setClientSecret(null)
  }

  const premiumFeatures = [
    "Full access to daily AI summaries",
    "Early previews and exclusive insights",
    "Daily email digest with bonus content",
    "Ad-free experience",
    "Multilingual content access",
    "Custom dashboard & push alerts",
    "Regional news filters and premium-only highlights"
  ]

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
      >
        Upgrade to Premium
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Upgrade to Premium</DialogTitle>
            <DialogDescription className="text-center">
              Get access to exclusive features and premium content
            </DialogDescription>
          </DialogHeader>

          {!clientSecret ? (
            <div className="py-6">
              <div className="mb-8">
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold">$19.99</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-center text-gray-600 mb-6">
                  Cancel anytime. No commitment required.
                </p>
              </div>

              <div className="space-y-4">
                {premiumFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="w-full max-w-[150px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpgrade}
                  className="w-full max-w-[150px] bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Continue"}
                </Button>
              </div>
            </div>
          ) : (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                },
              }}
            >
              <StripePaymentForm
                clientSecret={clientSecret}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
} 