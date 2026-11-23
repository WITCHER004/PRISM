import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { databaseConfigured, publicApiRoute } from "@/lib/server/api"
import { recordArticleView, viewFingerprint } from "@/lib/server/monetization"
import { adminConfigured, adminDb, verifyAppCheck, verifyRequestUser } from "@/lib/server/firebaseAdmin"
import { clientIp } from "@/lib/server/rateLimit"
import { COL } from "@/lib/live/schema"

// POST /api/articles/:id/views — counts a read once per reader (account, or salted IP + browser hash)
// per 24 hours. Browsers can't touch the counter directly (Firestore rules); this is the only way in.
const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (databaseConfigured()) return publicApiRoute((user) => recordArticleView(id, user, viewFingerprint(request, user)))
  if (!adminConfigured()) return NextResponse.json({ counted: false }, { status: 202 })
  if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid article." }, { status: 400 })
  if ((await verifyAppCheck(request)) === false) return NextResponse.json({ counted: false }, { status: 202 })

  const user = await verifyRequestUser(request)
  const salt = process.env.VIEW_FINGERPRINT_SALT || "prism-views"
  const who = user ? `u:${user.uid}` : `f:${clientIp(request.headers)}|${request.headers.get("user-agent") ?? ""}`
  const fp = createHash("sha256").update(`${salt}|${who}`).digest("hex").slice(0, 32)

  try {
    const db = adminDb()
    const articleRef = db.collection(COL.articles).doc(id)
    const seenRef = db.collection("view_dedupe").doc(`${id}_${fp}`)
    const counted = await db.runTransaction(async (tx) => {
      const [article, seen] = await Promise.all([tx.get(articleRef), tx.get(seenRef)])
      if (!article.exists || article.data()!.verificationStatus !== "published") return false
      if (article.data()!.authorId && user?.uid === article.data()!.authorId) return false // authors don't count
      const now = Date.now()
      if (seen.exists && (seen.data()!.at ?? 0) > now - DAY_MS) return false
      tx.set(seenRef, { at: now, expireAt: Timestamp.fromMillis(now + DAY_MS + 60_000) })
      tx.update(articleRef, { views: FieldValue.increment(1) })
      return true
    })
    return NextResponse.json({ counted })
  } catch (err) {
    console.error("[views]", id, err)
    return NextResponse.json({ counted: false }, { status: 202 })
  }
}
