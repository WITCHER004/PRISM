import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { checkRateLimit, clientIp } from "@/lib/server/rateLimit"
import { SITE_URL } from "@/lib/seo"
import { API_CSP, buildCsp, newNonce } from "@/lib/csp"

// Runs before every matched request (Next 16 "proxy", formerly middleware).
//   /api/*  → origin allowlist for state-changing calls, then per-IP rate limits (429 + Retry-After)
//   pages   → Supabase session refresh / protected-route redirects (no-op until Supabase is configured)

// Browsers may call the API only from Prism's own sites. Server-to-server callers (payment webhooks)
// send no Origin header and are authenticated by signature instead.
const ALLOWED_ORIGINS = new Set([
  SITE_URL.origin,
  "https://prism0.netlify.app",
  "https://prism-2d284.web.app",
  "https://prism-2d284.firebaseapp.com",
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
])

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function apiGuard(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin")
  if (origin && !SAFE_METHODS.has(request.method) && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 })
  }
  // No CORS grants: preflights from other origins get nothing back that would let them through
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204 })

  const result = checkRateLimit(request.nextUrl.pathname, clientIp(request.headers))
  if (!result.ok) {
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(result.retryAfter), "X-RateLimit-Limit": String(result.limit) } }
    )
  }
  return null
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const blocked = apiGuard(request)
    if (blocked) {
      blocked.headers.set("Content-Security-Policy", API_CSP)
      return blocked
    }
    const res = await updateSession(request)
    res.headers.set("Content-Security-Policy", API_CSP)
    return res
  }

  // Pages: a fresh nonce per request. Next reads it from the request's CSP header and stamps it on its
  // scripts; app/layout.tsx reads x-nonce for our own inline script.
  const nonce = newNonce()
  const csp = buildCsp(nonce)
  const headers = new Headers(request.headers)
  headers.set("x-nonce", nonce)
  headers.set("Content-Security-Policy", csp)
  const res = await updateSession(request, headers)
  res.headers.set("Content-Security-Policy", csp)
  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
