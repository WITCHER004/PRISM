import { publicApiRoute } from "@/lib/server/api"
import { recordArticleView, viewFingerprint } from "@/lib/server/monetization"

// POST /api/articles/:id/views — counts a read once per reader (user id, or IP + UA hash)
// per 24 hours, and credits the author's wallet if they're on Elite.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return publicApiRoute((user) => recordArticleView(id, user, viewFingerprint(request, user)))
}
