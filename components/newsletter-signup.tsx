"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, CheckCircle, AlertCircle } from "lucide-react"

export function NewsletterSignup() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setStatus("error")
      setMessage("Please enter your email address")
      return
    }

    setStatus("loading")

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name }),
      })

      const data = await response.json()

      if (data.success) {
        setStatus("success")
        setMessage("Successfully subscribed! Check your email for confirmation.")
        setEmail("")
        setName("")
      } else {
        setStatus("error")
        setMessage(data.error || "Failed to subscribe")
      }
    } catch (error) {
      setStatus("error")
      setMessage("Network error. Please try again.")
    }
  }

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto text-center p-6 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-800 mb-2">Welcome aboard!</h3>
        <p className="text-green-700">{message}</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === "loading"}
          />
          <Input
            type="email"
            placeholder="Enter your email for daily updates"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            required
          />
        </div>

        <Button type="submit" className="w-full flex items-center gap-2" disabled={status === "loading"}>
          <Mail className="h-4 w-4" />
          {status === "loading" ? "Subscribing..." : "Subscribe to Newsletter"}
        </Button>

        {status === "error" && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            {message}
          </div>
        )}
      </form>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Get daily AI-generated sports summaries and live updates. Unsubscribe anytime.
      </p>
    </div>
  )
}
