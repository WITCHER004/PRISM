import { z } from "zod"
import { apiRoute, readBody } from "@/lib/server/api"
import { castPanelVote } from "@/lib/server/publishing"

// POST /api/articles/:id/reviews/:reviewId/vote  { decision: "PASS" | "FAIL", failureReason? }
// A FAIL vote must carry a failureReason.
const Body = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("PASS") }),
  z.object({ decision: z.literal("FAIL"), failureReason: z.string({ error: "A FAIL vote needs a failureReason." }) }),
])

export async function POST(request: Request, ctx: { params: Promise<{ id: string; reviewId: string }> }) {
  const { id, reviewId } = await ctx.params
  return apiRoute(async (user) => {
    const body = await readBody(request, Body)
    return castPanelVote(user, id, reviewId, body.decision, body.decision === "FAIL" ? body.failureReason : undefined)
  })
}
