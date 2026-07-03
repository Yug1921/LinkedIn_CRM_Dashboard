import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const EXCLUDED_PATHS = ["/_next/static", "/_next/image", "/favicon.ico"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p) || pathname === p)) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  response.headers.set("X-XSS-Protection", "1; mode=block")

  return response
}
