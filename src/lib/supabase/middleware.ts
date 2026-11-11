import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
            request,
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
    request.nextUrl.pathname.startsWith("/review-dashboard") ||
    request.nextUrl.pathname === "/profile"

  if (isProtected && !user && process.env.NODE_ENV === "production") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirectTo", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

