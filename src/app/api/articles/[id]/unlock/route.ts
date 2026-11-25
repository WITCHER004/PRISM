import { NextResponse } from "next/server"
import { z } from "zod"
import { adminConfigured, adminDb, verifyRequestUser } from "@/lib/server/firebaseAdmin"
import { sharedRateLimit } from "@/lib/server/sharedRateLimit"
import { readerAccess, unlockStory } from "@/lib/server/publicArticles"

// POST /api/articles/:id/unlock { method: "meter" | "share" | "purchase" } — records a reader's unlock
// on the server and returns the story body. Unlocks used to live only in the browser (audit F-02).
const Body = z.object({ method: z.enum(["meter", "share", "purchase"]) })

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid story." }, { status: 400 })
  if (!adminConfigured()) return NextResponse.json({ error: "Stories are temporarily unavailable." }, { status: 503 })
  const caller = await verifyRequestUser(request)
  if (!caller) return NextResponse.json({ error: "Sign in to keep reading." }, { status: 401 })
  // Share-to-unlock can't be verified, so it is budgeted per account
  const limited = await sharedRateLimit(`unlock|${caller.uid}`, 20, 24 * 60 * 60_000)
  if (!limited.ok) return NextResponse.json({ error: "You've unlocked a lot of stories today. Try again tomorrow." }, { status: 429 })

  let method: z.infer<typeof Body>["method"]
  try {
    const parsed = Body.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    method = parsed.data.method
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const db = adminDb()
  const result = await unlockStory(db, id, caller.uid, method)
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status })
  const access = await readerAccess(db, id, { uid: caller.uid, isAdmin: caller.isAdmin })
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status })
  return NextResponse.json({ html: access.html, audiobookUrl: access.audiobookUrl, remaining: result.remaining }, { headers: { "cache-control": "private, no-store" } })
}
