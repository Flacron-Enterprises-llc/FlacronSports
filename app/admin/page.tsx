import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, FileText, Mail, DollarSign, Activity, Settings, Zap } from "lucide-react"
import { AdminAutomationPanel } from "@/components/admin-automation-panel"

export default function AdminDashboard() {
  // Mock data for dashboard
  const stats = {
    totalUsers: 12543,
    premiumUsers: 1876,
    articlesGenerated: 45,
    newslettersSent: 8932,
    revenue: 18764,
    apiCalls: 2341,
  }

  const recentArticles = [
    {
      id: 1,
      title: "Premier League Weekend Roundup",
      status: "Published",
      generatedAt: "2024-01-15 05:30:00",
      views: 2341,
    },
    {
      id: 2,
      title: "Champions League Analysis",
      status: "Published",
      generatedAt: "2024-01-14 05:30:00",
      views: 1876,
    },
    {
      id: 3,
      title: "Transfer Window Updates",
      status: "Scheduled",
      generatedAt: "2024-01-16 05:30:00",
      views: 0,
    },
  ]

  const newsletterStats = [
    {
      date: "2024-01-15",
      sent: 8932,
      opened: 4521,
      clicked: 892,
      openRate: "50.6%",
      clickRate: "10.0%",
    },
    {
      date: "2024-01-14",
      sent: 8876,
      opened: 4398,
      clicked: 876,
      openRate: "49.5%",
      clickRate: "9.9%",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-green-600 border-green-600">
                System Online
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Premium Users</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.premiumUsers.toLocaleString()}</p>
                </div>
                <Badge className="bg-yellow-500">{((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)}%</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">${stats.revenue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Articles This Month</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.articlesGenerated}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Newsletters Sent</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.newslettersSent.toLocaleString()}</p>
                </div>
                <Mail className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">API Calls Today</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.apiCalls.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="articles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="articles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  AI-Generated Articles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentArticles.map((article) => (
                    <div key={article.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{article.title}</h3>
                        <p className="text-sm text-gray-500">Generated: {article.generatedAt}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={article.status === "Published" ? "default" : "secondary"}>
                          {article.status}
                        </Badge>
                        <span className="text-sm text-gray-600">{article.views} views</span>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-between">
                  <Button variant="outline">
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Now
                  </Button>
                  <Button variant="outline">View All Articles</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="newsletters">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Newsletter Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {newsletterStats.map((stat, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Date</p>
                        <p className="text-sm text-gray-600">{stat.date}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Sent</p>
                        <p className="text-sm text-gray-600">{stat.sent.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Opened</p>
                        <p className="text-sm text-gray-600">{stat.opened.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Clicked</p>
                        <p className="text-sm text-gray-600">{stat.clicked.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Open Rate</p>
                        <p className="text-sm text-green-600 font-medium">{stat.openRate}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Click Rate</p>
                        <p className="text-sm text-blue-600 font-medium">{stat.clickRate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="text-2xl font-bold text-blue-600">{stats.totalUsers - stats.premiumUsers}</h3>
                    <p className="text-gray-600">Free Users</p>
                  </div>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="text-2xl font-bold text-yellow-600">{stats.premiumUsers}</h3>
                    <p className="text-gray-600">Premium Users</p>
                  </div>
                  <div className="text-center p-6 border rounded-lg">
                    <h3 className="text-2xl font-bold text-green-600">
                      {((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)}%
                    </h3>
                    <p className="text-gray-600">Conversion Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <AdminAutomationPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
