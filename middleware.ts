import { NextResponse, type NextRequest } from "next/server"

// English is served without a prefix, French under /fr. A request for /en/... is
// redirected so each page keeps one canonical URL.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname === "/fr" || pathname.startsWith("/fr/")) return NextResponse.next()
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return NextResponse.redirect(new URL(`${pathname.slice(3) || "/"}${search}`, request.url), 308)
  }

  const url = request.nextUrl.clone()
  url.pathname = `/en${pathname === "/" ? "" : pathname}`
  return NextResponse.rewrite(url)
}

export const config = { matcher: ["/((?!api|_next|brand|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|.*\\..*).*)"] }
