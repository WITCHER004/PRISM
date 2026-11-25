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
      // Sync the Supabase user to the database. An existing row is matched by supabaseId; it is linked
      // by email only when that email is confirmed and the row isn't linked to another login yet, so an
      // unconfirmed signup with someone else's address can't take over their account (audit F-18).
      try {
        const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Reader"
        const linked = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true } })
        if (linked) {
          await db.user.update({ where: { id: linked.id }, data: { displayName, avatarUrl: user.user_metadata?.avatar_url } })
        } else if (user.email) {
          const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at)
          const byEmail = await db.user.findUnique({ where: { email: user.email }, select: { id: true, supabaseId: true } })
          if (byEmail) {
            if (confirmed && !byEmail.supabaseId)
              await db.user.updateMany({ where: { id: byEmail.id, supabaseId: null }, data: { supabaseId: user.id, displayName, avatarUrl: user.user_metadata?.avatar_url } })
          } else {
            await db.user.create({
              data: {
                supabaseId: user.id,
                email: user.email,
                username: user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
                displayName,
                avatarUrl: user.user_metadata?.avatar_url,
                role: "READER",
              },
            })
          }
        }
      } catch (err) {
        console.error("Failed to sync user to Prisma DB:", err)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=Could+not+authenticate`)
}

