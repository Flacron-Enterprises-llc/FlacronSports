"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

interface FollowButtonProps {
  followType: "author" | "team" | "tag"
  followId: string
  label: string
}

export function FollowButton({ followType, followId, label }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleFollow = async () => {
    setIsLoading(true)

    try {
      // In a real implementation, this would call the API
      // For now, just toggle the state
      const method = isFollowing ? "DELETE" : "POST"

      const response = await fetch("/api/follow", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "current-user", // In a real app, this would be the actual user ID
          followType,
          followId,
        }),
      })

      if (response.ok) {
        setIsFollowing(!isFollowing)
      }
    } catch (error) {
      console.error("Error following:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? "default" : "outline"}
      size="sm"
      onClick={handleFollow}
      disabled={isLoading}
      className="flex items-center gap-1"
    >
      <Star className="h-3 w-3" />
      <span>{isFollowing ? "Following" : `Follow ${label}`}</span>
    </Button>
  )
}
