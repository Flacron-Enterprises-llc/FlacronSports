import { NextResponse, type NextRequest } from "next/server"

// The host is client supplied, so a redirect target only ever comes from this table.
const CANONICAL_HOSTS = new Map([["www.flacronsport.com", "flacronsport.com"]])

// English is served without a prefix, French under /fr. A request for /en/... is
// redirected so each page keeps one canonical URL.
export function middleware(request: NextRequest) {
  // ECS answers every path API Gateway sends it and reads the provider directly,
  // so a page rendered there would skip the plan check pages get through the backend.
  if (process.env.BACKEND_ONLY === "true") return new NextResponse(null, { status: 404 })

  const { pathname, search } = request.nextUrl

  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim().split(":")[0].toLowerCase()
  const canonical = CANONICAL_HOSTS.get(host)
  if (canonical) {
    return NextResponse.redirect(`https://${canonical}${pathname}${search}`, 308)
  }

  if (pathname === "/fr" || pathname.startsWith("/fr/")) {
    const response = NextResponse.next()
    response.headers.set("Link", alternates(request, pathname.slice(3) || "/", "fr"))
    return response
  }
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return NextResponse.redirect(new URL(`${pathname.slice(3) || "/"}${search}`, request.url), 308)
  }

  const url = request.nextUrl.clone()
  url.pathname = `/en${pathname === "/" ? "" : pathname}`
  const response = NextResponse.rewrite(url)
  response.headers.set("Link", alternates(request, pathname, "en"))
  return response
}

/** Canonical and hreflang through a header, so every page gets them from one place. */
function alternates(request: NextRequest, path: string, locale: "en" | "fr"): string {
  const base = process.env.APP_BASE_URL || request.nextUrl.origin
  const suffix = path === "/" ? "" : path
  const en = `${base}${path}`
  const fr = `${base}/fr${suffix}`
  return [
    `<${locale === "en" ? en : fr}>; rel="canonical"`,
    `<${en}>; rel="alternate"; hreflang="en"`,
    `<${fr}>; rel="alternate"; hreflang="fr"`,
    `<${en}>; rel="alternate"; hreflang="x-default"`,
  ].join(", ")
}

// Team names can contain dots ("St. Louis Blues"), which the file rule below would skip.
export const config = { matcher: ["/app/team/:name", "/:locale(en|fr)/app/:path*", "/((?!api|_next|brand|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|.*\\..*).*)"] }
