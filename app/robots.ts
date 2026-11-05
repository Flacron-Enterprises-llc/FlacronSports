import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_BASE_URL || "https://flacronsport.com"
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/admin", "/signin", "/signup", "/verify-email", "/payment-success", "/my-teams"] },
    sitemap: `${base}/sitemap.xml`,
  }
}
