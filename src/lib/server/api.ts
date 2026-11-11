import { NextResponse } from "next/server"
import type { z } from "zod"
import { ActionError, getSessionDbUser } from "@/lib/session"

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionDbUser>>>

/** Demo mode keeps these flows in the browser store; the API needs a database */
export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

const NO_DB = {
  error: "No database is configured. In demo mode this flow runs in the browser store (src/lib/store.ts).",
}

async function run<T>(fn: (user: SessionUser | null) => Promise<T>, requireAuth: boolean): Promise<NextResponse> {
  if (!databaseConfigured()) return NextResponse.json(NO_DB, { status: 503 })
  try {
    const user = await getSessionDbUser()
    if (requireAuth && !user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 })
    return NextResponse.json(await fn(user))
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error(err)
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 })
  }
}

/** Route handler for signed-in users: database check, auth, ActionError → HTTP status */
export function apiRoute<T>(fn: (user: SessionUser) => Promise<T>) {
  return run((user) => fn(user!), true)
}

/** Route handler signed-out readers may call too */
export function publicApiRoute<T>(fn: (user: SessionUser | null) => Promise<T>) {
  return run(fn, false)
}

/** Parses a JSON body against a schema, throwing a 400 ActionError on failure */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ActionError("Expected a JSON body.")
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Invalid request.")
  return parsed.data
}
