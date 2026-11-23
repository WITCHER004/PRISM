import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest, requestHeaders: Headers = request.headers) {
  // requestHeaders carries the per-request CSP nonce through to rendering
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // If supabase env vars are placeholders/demo, bypass cleanly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes("demo-anon-key")) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect editor and dashboard if user is not authenticated and real keys are set
  const isProtected =
    request.nextUrl.pathname.startsWith("/editor") ||
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/panel") ||
    request.nextUrl.pathname === "/profile"

  if (isProtected && !user && process.env.NODE_ENV === "production") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirectTo", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

