"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface HealthData {
  status: string
  timestamp: string
  services: {
    api: string
    thesportsdb: string
    firebase: string
  }
  environment: {
    nodeEnv: string
    hasFirebaseConfig: boolean
  }
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health")
        if (response.ok) {
          const data = await response.json()
          setHealth(data)
        }
      } catch (error) {
        console.error("Health check failed:", error)
      } finally {
        setLoading(false)
      }
    }

    checkHealth()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
      case "available":
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "disabled":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
      case "available":
      case "healthy":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Online
          </Badge>
        )
      case "disabled":
        return <Badge variant="secondary">Disabled</Badge>
      default:
        return <Badge variant="destructive">Offline</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {health ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm">API Server</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.services.api)}
                {getStatusBadge(health.services.api)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">TheSportsDB</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.services.thesportsdb)}
                {getStatusBadge(health.services.thesportsdb)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Firebase</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(health.services.firebase)}
                {getStatusBadge(health.services.firebase)}
              </div>
            </div>
            <div className="pt-2 border-t text-xs text-gray-500">Environment: {health.environment.nodeEnv}</div>
          </>
        ) : (
          <div className="text-center text-red-500">
            <XCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Health check failed</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
