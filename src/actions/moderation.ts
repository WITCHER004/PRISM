"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { canReview, canTransition } from "@/lib/moderation/workflow"
import type { ArticleStatus, ReviewTrack } from "@/lib/moderation/types"
import { approveByEmployee, submitArticle } from "@/lib/server/publishing"
import { awardBadges } from "@/lib/server/badges"
import { ActionError, requireUser, runAction } from "@/lib/session"

// Two-phase publishing, database edition. The UI in demo mode drives the same state machine
// through the browser store (src/lib/store.ts); these actions are the server-side source of
// truth once DATABASE_URL and Supabase auth are configured.

/**
 * Author submits: 150-word minimum → Phase 1 AI check → PHASE_1_FAILED or PENDING_EMPLOYEE_REVIEW.
 * The plan decides what follows the employee: Free publishes, Elite goes to the 10-member panel.
 * Shared with POST /api/articles/[id]/submit.
 */
export async function submitArticleForReview(postId: string) {
  return runAction(async () => {
    const user = await requireUser()
    const result = await submitArticle(user, postId)
    revalidatePath("/dashboard")
    revalidatePath("/review-dashboard")
    return result
  })
}

/** Phase 2 queue: oldest submissions first */
export async function getReviewQueue() {
  return runAction(async () => {
    const user = await requireUser()
    if (!canReview(user.role)) throw new ActionError("Only reviewers can open the review queue.")
    return db.post.findMany({
      where: { status: "PENDING_EMPLOYEE_REVIEW" },
      orderBy: { submittedAt: "asc" },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    })
  })
}

const Decision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED"), notes: z.string().max(2000).optional() }),
  z.object({ decision: z.literal("REJECTED"), notes: z.string().trim().min(10, "Tell the author what to change (10+ characters).").max(2000) }),
])

/** Phase 2: an employee approves (Free → PUBLISHED, Elite → PENDING_PEER_PANEL) or rejects with notes */
export async function reviewArticle(postId: string, input: z.input<typeof Decision>) {
  return runAction(async () => {
    const reviewer = await requireUser()
    if (!canReview(reviewer.role)) throw new ActionError("Only reviewers can approve or reject articles.")
    const parsed = Decision.safeParse(input)
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Invalid decision.")
    const { decision, notes } = parsed.data

    const post = await db.post.findUnique({ where: { id: postId }, include: { author: { select: { username: true } } } })
    if (!post) throw new ActionError("Article not found.")
    if (post.authorId === reviewer.id) throw new ActionError("You can't review your own article.")
    if (post.status !== "PENDING_EMPLOYEE_REVIEW") throw new ActionError("This article is no longer waiting for review.")

    const to: ArticleStatus = await db.$transaction(async (tx) => {
      const next: ArticleStatus =
        decision === "APPROVED" ? await approveByEmployee(tx, { id: post.id, authorId: post.authorId, reviewTrack: post.reviewTrack as ReviewTrack | null }) : "REJECTED"
      if (!canTransition("PENDING_EMPLOYEE_REVIEW", next)) throw new ActionError("Invalid transition.")
      // Conditional update so two reviewers can't both decide the same submission
      const { count } = await tx.post.updateMany({
        where: { id: post.id, status: "PENDING_EMPLOYEE_REVIEW" },
        data: {
          status: next,
          reviewDecision: decision,
          reviewerNotes: notes?.trim() || null,
          reviewedById: reviewer.id,
          reviewedAt: new Date(),
          ...(next === "PUBLISHED" ? { publishedAt: post.publishedAt ?? new Date() } : {}),
        },
      })
      if (count === 0) throw new ActionError("Another reviewer already decided this article.")
      return next
    })
    if (to === "PUBLISHED") await awardBadges(post.authorId)

    revalidatePath("/review-dashboard")
    revalidatePath(`/${post.author.username}/${post.slug}`)
    revalidatePath("/")
    return { status: to }
  })
}
