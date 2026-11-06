import path from "node:path"

/** @type {import('next').NextConfig} */

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com",
  "frame-src https://*.firebaseapp.com https://www.youtube-nocookie.com https://www.scorebat.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'none'",
].join("; ")

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve("."),
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
  // On Amplify the browser keeps calling same-origin /api, which forwards to ECS.
  // Unset in the ECS image, where the same routes run directly.
  async rewrites() {
    const origin = process.env.API_ORIGIN
    return origin ? { beforeFiles: [{ source: "/api/:path*", destination: `${origin}/api/:path*` }] } : []
  },
  async redirects() {
    return [
      { source: "/blog", destination: "/app/news", permanent: true },
      { source: "/blog/:path*", destination: "/app/news", permanent: true },
      { source: "/dashboard", destination: "/app/billing", permanent: true },
      ...["scores", "watch", "news", "my-teams", "notifications", "assistant", "settings", "rooms", "match", "team", "standings"].flatMap((name) => [
        { source: `/${name}`, destination: `/app/${name}`, permanent: true },
        { source: `/${name}/:path*`, destination: `/app/${name}/:path*`, permanent: true },
      ]),
    ]
  },
}

export default nextConfig
