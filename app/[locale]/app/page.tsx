import { DashboardHome } from "@/components/dashboard/dashboard-home"
import { getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  return <DashboardHome feed={await getEvents()} />
}
