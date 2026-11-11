import type { Phase1Report } from "./types"

/** Calls the Phase 1 analyzer endpoint (POST /api/moderation/analyze) */
export async function requestPhase1(input: { title: string; contentHtml: string }): Promise<{ report: Phase1Report } | { error: string }> {
  try {
    const res = await fetch("/api/moderation/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
    const body = (await res.json().catch(() => ({}))) as { report?: Phase1Report; error?: string }
    if (!res.ok || !body.report) return { error: body.error ?? "The content check didn't respond. Try again in a moment." }
    return { report: body.report }
  } catch {
    return { error: "Couldn't reach the content check. Check your connection and try again." }
  }
}
