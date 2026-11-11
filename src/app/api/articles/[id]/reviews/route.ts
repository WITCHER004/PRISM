import { apiRoute } from "@/lib/server/api"
import { db } from "@/lib/db"
import { canReview } from "@/lib/moderation/workflow"
import { ActionError } from "@/lib/session"
import { getPanel } from "@/lib/server/publishing"

// GET /api/articles/:id/reviews — the peer-panel scorecard for the latest submission.
// Visible to the author, panel members on it, and staff.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return apiRoute(async (user) => {
    const post = await db.post.findUnique({ where: { id }, select: { authorId: true } })
    if (!post) throw new ActionError("Article not found.", 404)
    const panel = await getPanel(id)
    const onPanel = panel.votes.some((v) => v.reviewerId === user.id)
    if (post.authorId !== user.id && !onPanel && !canReview(user.role)) throw new ActionError("Not allowed.", 403)
    return panel
  })
}
