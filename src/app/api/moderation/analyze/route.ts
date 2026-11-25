import { NextResponse } from "next/server"
import { z } from "zod"
import { analyzeArticle } from "@/lib/moderation/analyzer"
import { MIN_WORDS_FOR_SUBMISSION } from "@/lib/moderation/workflow"
import { verifyAppCheck, verifyRequestUser } from "@/lib/server/firebaseAdmin"
import { sharedRateLimit } from "@/lib/server/sharedRateLimit"

// Phase 1: score an article for AI-generated content.
// POST { title?, contentHtml } → Phase1Report
// The DB-backed submit action (src/actions/moderation.ts) runs the same analyzer server-side,
// so a client can't skip this check by calling the review queue directly.

// The ML engine runs transformer models; give the submit check room to finish
export const maxDuration = 90

const Body = z.object({
  title: z.string().max(300).optional(),
  contentHtml: z.string().min(1).max(200_000),
})

export async function POST(request: Request) {
  // The external AI-detection API costs money per call: only the Prism app may use it
  if ((await verifyAppCheck(request)) === false) return NextResponse.json({ error: "This request didn't come from the Prism app." }, { status: 401 })
  // Signed-in writers only, with a per-account budget: each call can reach the paid detector
  const caller = await verifyRequestUser(request)
  if (!caller) return NextResponse.json({ error: "Sign in to check a story." }, { status: 401 })
  const limited = await sharedRateLimit(`analyze|${caller.uid}`, 10, 60 * 60_000)
  if (!limited.ok) return NextResponse.json({ error: "You've run the content check a lot this hour. Try again later." }, { status: 429 })
  let parsed
  try {
    parsed = Body.safeParse(await request.json())
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Send the article as { title, contentHtml }." }, { status: 400 })
  }

  const report = await analyzeArticle(parsed.data)
  if (report.wordCount < MIN_WORDS_FOR_SUBMISSION) {
    return NextResponse.json(
      { error: `Write at least ${MIN_WORDS_FOR_SUBMISSION} words before submitting — there's too little text to check.`, report },
      { status: 422 }
    )
  }
  return NextResponse.json({ report })
}
