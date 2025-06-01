import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Star, Zap, Crown, Mail, BarChart3 } from "lucide-react"
import Link from "next/link"

export default function SubscriptionPage() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for casual sports fans",
      features: [
        "Access to live scores",
        "Limited daily blog summaries",
        "Weekly newsletter",
        "Basic match statistics",
        "Community access",
      ],
      limitations: ["Ads displayed", "Limited AI insights", "No premium content"],
      buttonText: "Current Plan",
      buttonVariant: "outline" as const,
      popular: false,
    },
    {
      name: "Premium",
      price: "$9.99",
      period: "month",
      description: "For serious sports enthusiasts",
      features: [
        "Everything in Free",
        "Full access to daily AI summaries",
        "Early previews and exclusive insights",
        "Daily email digest with bonus content",
        "Ad-free experience",
        "Advanced statistics and analytics",
        "Priority customer support",
        "Mobile app access",
      ],
      limitations: [],
      buttonText: "Upgrade to Premium",
      buttonVariant: "default" as const,
      popular: true,
    },
    {
      name: "Pro",
      price: "$19.99",
      period: "month",
      description: "For professionals and analysts",
      features: [
        "Everything in Premium",
        "API access for data integration",
        "Custom AI analysis requests",
        "White-label newsletter options",
        "Advanced predictive analytics",
        "Direct analyst consultation",
        "Custom reporting tools",
        "Team collaboration features",
      ],
      limitations: [],
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const,
      popular: false,
    },
  ]

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Sports Journalist",
      content:
        "The AI-generated summaries save me hours of research time. The insights are incredibly accurate and well-written.",
      rating: 5,
    },
    {
      name: "Mike Chen",
      role: "Fantasy Sports Player",
      content: "Premium analytics have improved my fantasy team performance significantly. Worth every penny!",
      rating: 5,
    },
    {
      name: "David Rodriguez",
      role: "Sports Blogger",
      content: "The daily newsletter keeps me updated on everything I need to know. Great content quality.",
      rating: 5,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-600">FlacronSport Daily</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-700 hover:text-blue-600">
                Live Scores
              </Link>
              <Link href="/blog" className="text-gray-700 hover:text-blue-600">
                News
              </Link>
              <Link href="/subscription" className="text-blue-600 font-medium">
                Premium
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Sports Experience</h1>
          <p className="text-xl text-gray-600 mb-8">Get AI-powered insights, exclusive content, and ad-free browsing</p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>AI-Powered Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <span>Daily Newsletters</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-green-500" />
              <span>Advanced Analytics</span>
            </div>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative ${plan.popular ? "ring-2 ring-blue-500 shadow-lg scale-105" : ""}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-4 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
                <p className="text-gray-600 mt-2">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {plan.limitations.map((limitation, limitationIndex) => (
                    <li key={limitationIndex} className="flex items-center gap-2 text-gray-500">
                      <span className="text-sm">• {limitation}</span>
                    </li>
                  ))}
                </ul>
                <Button variant={plan.buttonVariant} className="w-full" size="lg">
                  {plan.buttonText}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Comparison */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle className="text-center">Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Features</th>
                    <th className="text-center py-3 px-4">Free</th>
                    <th className="text-center py-3 px-4">Premium</th>
                    <th className="text-center py-3 px-4">Pro</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b">
                    <td className="py-3 px-4">Live Scores</td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">AI-Generated Summaries</td>
                    <td className="text-center py-3 px-4 text-gray-400">Limited</td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Ad-Free Experience</td>
                    <td className="text-center py-3 px-4 text-gray-400">✗</td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">API Access</td>
                    <td className="text-center py-3 px-4 text-gray-400">✗</td>
                    <td className="text-center py-3 px-4 text-gray-400">✗</td>
                    <td className="text-center py-3 px-4">
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">What Our Users Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center">
          <CardContent className="py-12">
            <Crown className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-3xl font-bold mb-4">Ready to Upgrade?</h2>
            <p className="text-xl mb-8 text-blue-100">
              Join thousands of sports fans getting premium AI-powered insights
            </p>
            <Button size="lg" variant="secondary" className="mr-4">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
              View Demo
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
