"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, RefreshCw, Clock, Zap } from "lucide-react"

interface AutomationJob {
  id: string
  name: string
  schedule: string
  lastRun?: Date
  nextRun?: Date
  status: "active" | "paused" | "error"
}

export function AdminAutomationPanel() {
  const [jobs, setJobs] = useState<AutomationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)

  const fetchAutomationStatus = async () => {
    try {
      const response = await fetch("/api/automation/status")
      const data = await response.json()

      if (data.success) {
        setJobs(data.data)
      }
    } catch (error) {
      console.error("Error fetching automation status:", error)
    } finally {
      setLoading(false)
    }
  }

  const triggerJob = async (jobId: string) => {
    setTriggering(jobId)

    try {
      const response = await fetch("/api/automation/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh status after triggering
        await fetchAutomationStatus()
      }
    } catch (error) {
      console.error("Error triggering job:", error)
    } finally {
      setTriggering(null)
    }
  }

  useEffect(() => {
    fetchAutomationStatus()

    // Refresh every 30 seconds
    const interval = setInterval(fetchAutomationStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-600"
      case "paused":
        return "bg-yellow-600"
      case "error":
        return "bg-red-600"
      default:
        return "bg-gray-600"
    }
  }

  const getJobIcon = (jobId: string) => {
    switch (jobId) {
      case "daily-content-generation":
        return <Zap className="h-4 w-4" />
      case "newsletter-sending":
        return <Clock className="h-4 w-4" />
      default:
        return <RefreshCw className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Automation Status</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchAutomationStatus}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {getJobIcon(job.id)}
              <div>
                <h3 className="font-medium">{job.name}</h3>
                <p className="text-sm text-gray-500">Schedule: {job.schedule}</p>
                {job.lastRun && (
                  <p className="text-xs text-gray-400">Last run: {new Date(job.lastRun).toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(job.status)}>{job.status}</Badge>

              <Button variant="outline" size="sm" onClick={() => triggerJob(job.id)} disabled={triggering === job.id}>
                {triggering === job.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {triggering === job.id ? "Running..." : "Trigger"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
