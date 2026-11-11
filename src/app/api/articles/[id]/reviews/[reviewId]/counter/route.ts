import { z } from "zod"
import { apiRoute, readBody } from "@/lib/server/api"
import { submitCounter } from "@/lib/server/publishing"

// POST /api/articles/:id/reviews/:reviewId/counter  { counterReason, clarification? }
// The author appeals a FAIL vote (reviewId = PeerPanelReview id) or an employee rejection
// (reviewId = "employee"). The article moves to COUNTER_SUBMITTED.
const Body = z.object({
  counterReason: z.string({ error: "counterReason is required." }),
  clarification: z.string().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string; reviewId: string }> }) {
  const { id, reviewId } = await ctx.params
  return apiRoute(async (user) => {
    const body = await readBody(request, Body)
    return submitCounter(user, id, reviewId, body.counterReason, body.clarification)
  })
}
