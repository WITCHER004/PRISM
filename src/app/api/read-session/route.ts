import { NextResponse } from "next/server"
import { recordReadSession } from "@/actions/interactions"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { postId, durationSec, scrollDepth, userId } = body

    if (!postId || typeof durationSec !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    await recordReadSession(postId, durationSec, scrollDepth || 0, userId)
    return NextResponse.json({ recorded: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

