import { NextResponse } from "next/server"
import { z } from "zod"
import { analyzeArticle } from "@/lib/moderation/analyzer"
import { MIN_WORDS_FOR_SUBMISSION } from "@/lib/moderation/workflow"

// Phase 1: score an article for AI-generated content.
// POST { title?, contentHtml } → Phase1Report
// The DB-backed submit action (src/actions/moderation.ts) runs the same analyzer server-side,
// so a client can't skip this check by calling the review queue directly.

const Body = z.object({
  title: z.string().max(300).optional(),
  contentHtml: z.string().min(1).max(400_000),
})

export async function POST(request: Request) {
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
