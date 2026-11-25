import { NextResponse } from "next/server"
import { adminConfigured, verifyRequestUser } from "@/lib/server/firebaseAdmin"

// GET /api/auth/role (Authorization: Bearer <Firebase ID token>) → { isAdmin }
// Lets the browser learn whether the signed-in account is staff without shipping the admin list.
// UI only: Firestore/Storage rules and the server routes enforce admin rights on their own.
const noStore = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: "Role checks aren't configured." }, { status: 503, headers: noStore })
  const user = await verifyRequestUser(request)
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore })
  return NextResponse.json({ isAdmin: user.isAdmin }, { headers: noStore })
}
