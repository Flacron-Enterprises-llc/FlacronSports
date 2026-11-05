import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_BASE_URL || "https://flacronsport.com"
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app", "/fr/app", "/signin", "/signup", "/verify-email", "/auth/"] },
    sitemap: `${base}/sitemap.xml`,
  }
}
