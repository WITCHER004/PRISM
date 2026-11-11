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
    return await db.user.findFirst({
      where: { OR: [{ supabaseId: user.id }, ...(user.email ? [{ email: user.email }] : [])] },
    })
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
