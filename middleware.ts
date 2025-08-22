import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Redirect service worker requests to our API routes
  if (pathname === '/sw.js') {
    return NextResponse.redirect(new URL('/api/sw', request.url))
  }
  
  if (pathname === '/sw (2).js') {
    return NextResponse.redirect(new URL('/api/sw2', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/sw.js',
    '/sw (2).js'
  ]
}
