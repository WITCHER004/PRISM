import { z } from "zod"
import { apiRoute, readBody } from "@/lib/server/api"
import { reconsiderCounter } from "@/lib/server/publishing"

// PATCH /api/articles/:id/reviews/:reviewId/reconsider  { verdict: "ACCEPT" | "UPHOLD", note? }
// ACCEPT flips the FAIL vote to PASS (publishing once consensus is met) or, for an employee
// appeal (reviewId = "employee"), publishes. UPHOLD keeps the decision and needs a closing note.
const Body = z.object({ verdict: z.enum(["ACCEPT", "UPHOLD"]), note: z.string().default("") })

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string; reviewId: string }> }) {
  const { id, reviewId } = await ctx.params
  return apiRoute(async (user) => {
    const body = await readBody(request, Body)
    return reconsiderCounter(user, id, reviewId, body.verdict, body.note)
  })
}
