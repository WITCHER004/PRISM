import { NextResponse } from "next/server"
import { recordReadSession } from "@/actions/interactions"
import { databaseConfigured } from "@/lib/server/api"

// POST /api/read-session { postId, durationSec, scrollDepth } — reading telemetry (sendBeacon).
// The reader is taken from the session; any userId in the body is ignored.
export async function POST(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ recorded: false }, { status: 202 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }
  const result = await recordReadSession(body as Parameters<typeof recordReadSession>[0])
  return result.success
    ? NextResponse.json({ recorded: true })
    : NextResponse.json({ error: "Invalid payload." }, { status: 400 })
}
