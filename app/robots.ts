import type { MetadataRoute } from "next"

const PRIVATE = ["/app", "/signin", "/signup", "/forgot-password", "/verify-email", "/auth/"]

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_BASE_URL || "https://flacronsport.com"
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...PRIVATE.flatMap((path) => [path, `/fr${path}`])] },
    sitemap: `${base}/sitemap.xml`,
  }
}
