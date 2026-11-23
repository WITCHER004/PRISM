import { NextResponse } from "next/server"
import { z } from "zod"
import { verifyAppCheck } from "@/lib/server/firebaseAdmin"
import { clientIp } from "@/lib/server/rateLimit"
import { fingerprint, sharedRateLimit } from "@/lib/server/sharedRateLimit"

// POST /api/auth/attempt { kind, email? } — asked before every email/password sign-in, sign-up and
// password reset. Limits are per IP and per email address, shared across server instances, and
// answer 429 with Retry-After. (Firebase Auth adds its own lockouts on top; enforcing App Check for
// Authentication in the console stops scripts that call Firebase directly.)

const LIMITS = {
  signin: { ip: [20, 15 * 60_000], email: [8, 15 * 60_000] },
  signup: { ip: [5, 60 * 60_000], email: [3, 60 * 60_000] },
  reset: { ip: [5, 60 * 60_000], email: [3, 60 * 60_000] },
} as const

const Body = z.object({
  kind: z.enum(["signin", "signup", "reset"]),
  email: z.string().trim().max(254).optional(),
})

const retryText = (s: number) => (s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`)

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  if ((await verifyAppCheck(request)) === false) return NextResponse.json({ error: "This request didn't come from the Prism app." }, { status: 401 })

  const { kind, email } = parsed.data
  const limits = LIMITS[kind]
  const checks = [sharedRateLimit(`auth|${kind}|ip|${fingerprint(clientIp(request.headers))}`, limits.ip[0], limits.ip[1])]
  if (email) checks.push(sharedRateLimit(`auth|${kind}|email|${fingerprint(email)}`, limits.email[0], limits.email[1]))
  const results = await Promise.all(checks)
  const blocked = results.find((r) => !r.ok)
  if (blocked && !blocked.ok) {
    const what = kind === "signup" ? "sign-up attempts" : kind === "reset" ? "reset requests" : "sign-in attempts"
    return NextResponse.json(
      { error: `Too many ${what}. Try again in ${retryText(blocked.retryAfter)}.`, retryAfter: blocked.retryAfter },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } }
    )
  }
  return NextResponse.json({ ok: true })
}
