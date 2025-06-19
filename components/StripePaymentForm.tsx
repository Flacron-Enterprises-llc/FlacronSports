import { useState } from "react"
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Lock } from "lucide-react"

interface StripePaymentFormProps {
  clientSecret: string
  onSuccess: () => void
  onCancel: () => void
}

export default function StripePaymentForm({
  clientSecret,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      })

      if (error) {
        toast.error(error.message || "An error occurred during payment")
      } else {
        onSuccess()
      }
    } catch (err) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2 mb-4 text-sm text-gray-600">
          <Lock className="h-4 w-4" />
          <span>Secure payment powered by Stripe</span>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Premium Subscription</span>
            <span className="font-semibold">$19.99/month</span>
          </div>
          <div className="text-sm text-gray-500">
            Cancel anytime. Your subscription will start immediately.
          </div>
        </div>
        <PaymentElement className="bg-white p-4 rounded-lg shadow-sm" />
      </div>
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            "Pay & Subscribe"
          )}
        </Button>
      </div>
      <div className="mt-4 text-center text-xs text-gray-500">
        By subscribing, you agree to our Terms of Service and Privacy Policy
      </div>
    </form>
  )
} 