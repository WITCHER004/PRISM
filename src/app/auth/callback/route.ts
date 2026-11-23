import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // Only ever continue to a page on this site (no //host, /\host or @host tricks)
  let target: URL
  try {
    target = new URL(searchParams.get("next") ?? "/dashboard", origin)
  } catch {
    target = new URL("/dashboard", origin)
  }
  const next = target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      const { user } = data
      // Sync/upsert the Supabase user to Prisma database
      try {
        await db.user.upsert({
          where: { email: user.email! },
          update: {
            supabaseId: user.id,
            displayName: user.user_metadata?.full_name || user.email!.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url,
          },
          create: {
            supabaseId: user.id,
            email: user.email!,
            username: user.email!.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
            displayName: user.user_metadata?.full_name || user.email!.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url,
            role: "READER",
          },
        })
      } catch (err) {
        console.error("Failed to sync user to Prisma DB:", err)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Could+not+authenticate`)
}

