import { db } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { isEliteActive } from "@/lib/elite/subscription"

/** The signed-in user's database row, or null (signed out, or no DB/auth configured) */
export async function getSessionDbUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    // Resolve by the auth id first. Linking by email is only safe when Supabase has confirmed that the
    // caller owns the address, and only onto a row no other auth identity has claimed (audit F-18).
    const linked = await db.user.findUnique({ where: { supabaseId: user.id } })
    if (linked) return linked
    const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at)
    if (!user.email || !emailConfirmed) return null
    const byEmail = await db.user.findUnique({ where: { email: user.email } })
    if (!byEmail || byEmail.supabaseId) return null
    // Guarded update: if a concurrent request linked the row first, nothing changes and we re-read
    const { count } = await db.user.updateMany({ where: { id: byEmail.id, supabaseId: null }, data: { supabaseId: user.id } })
    if (count === 0) return await db.user.findUnique({ where: { supabaseId: user.id } })
    return { ...byEmail, supabaseId: user.id }
  } catch {
    return null
  }
}

export class ActionError extends Error {
  constructor(
    message: string,
    /** HTTP status when surfaced through an API route */
    readonly status = 400
  ) {
    super(message)
  }
}

export async function requireUser() {
  const user = await getSessionDbUser()
  if (!user) throw new ActionError("Sign in to continue.", 401)
  return user
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionDbUser>>>

/** Elite guard for paid features: tier ELITE, status ACTIVE, not expired */
export function requireElite(user: SessionUser) {
  if (!isEliteActive(user)) throw new ActionError("This is an Elite feature. Upgrade at /elite to use it.", 403)
  return user
}

export async function requireEliteUser() {
  return requireElite(await requireUser())
}

/** Wraps an action body so expected failures come back as { success: false, error } */
export async function runAction<T>(fn: () => Promise<T>): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    return { success: true, data: await fn() }
  } catch (err) {
    if (err instanceof ActionError) return { success: false, error: err.message }
    console.error(err)
    return { success: false, error: "Something went wrong. Try again." }
  }
}
