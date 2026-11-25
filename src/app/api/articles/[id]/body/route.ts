import { NextResponse } from "next/server"
import { adminConfigured, adminDb, verifyRequestUser } from "@/lib/server/firebaseAdmin"
import { sharedRateLimit } from "@/lib/server/sharedRateLimit"
import { clientIp } from "@/lib/server/rateLimit"
import { readerAccess } from "@/lib/server/publicArticles"

// GET /api/articles/:id/body — the full text of a story, for readers entitled to it (audit F-02).
// Free stories: anyone. Locked ones: the author, staff, Elite members, or a reader who unlocked it
// (POST /api/articles/:id/unlock). Everyone else gets the reason instead of the text.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid story." }, { status: 400 })
  if (!adminConfigured()) return NextResponse.json({ error: "Stories are temporarily unavailable." }, { status: 503 })
  const caller = await verifyRequestUser(request)
  const limited = await sharedRateLimit(`body|${caller?.uid ?? clientIp(request.headers)}`, 120, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })

  const access = await readerAccess(adminDb(), id, caller ? { uid: caller.uid, isAdmin: caller.isAdmin } : null)
  const headers = { "cache-control": "private, no-store" }
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status, headers })
  return NextResponse.json({ html: access.html, audiobookUrl: access.audiobookUrl, via: access.via }, { headers })
}
