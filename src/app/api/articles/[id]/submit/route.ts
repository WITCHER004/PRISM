import { apiRoute } from "@/lib/server/api"
import { submitArticle } from "@/lib/server/publishing"

// POST /api/articles/:id/submit
// 150-word minimum → Phase 1 AI check (≤ 20% AI) → employee queue. After employee approval,
// Free articles publish and Elite articles go to the 10-member peer panel. The route is set by
// the author's plan, not the request.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return apiRoute((user) => submitArticle(user, id))
}
