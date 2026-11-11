"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { ActionError, requireUser, runAction } from "@/lib/session"
import { REVIEW_BODY_MAX } from "@/lib/reviews"

// Reader star ratings + written reviews (database edition). One review per reader per article,
// enforced by @@unique([userId, postId]); the article's average/count are kept in sync.

const ReviewInput = z.object({
  rating: z.number().int().min(1, "Pick 1 to 5 stars.").max(5, "Pick 1 to 5 stars."),
  body: z.string().trim().max(REVIEW_BODY_MAX, `Keep reviews under ${REVIEW_BODY_MAX} characters.`).default(""),
})

async function refreshAggregate(postId: string) {
  const agg = await db.articleReview.aggregate({ where: { postId }, _avg: { rating: true }, _count: true })
  const post = await db.post.update({
    where: { id: postId },
    data: { ratingAverage: agg._avg.rating ?? 0, ratingCount: agg._count },
    select: { slug: true, author: { select: { username: true } } },
  })
  revalidatePath(`/${post.author.username}/${post.slug}`)
}

export async function getArticleReviews(postId: string) {
  return runAction(() =>
    db.articleReview.findMany({
      where: { postId },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
    })
  )
}

/** Create or edit the signed-in reader's review (upsert keeps it to one per article) */
export async function saveArticleReview(postId: string, input: z.input<typeof ReviewInput>) {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = ReviewInput.safeParse(input)
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Invalid review.")

    const post = await db.post.findUnique({ where: { id: postId }, select: { status: true, authorId: true } })
    if (!post || post.status !== "PUBLISHED") throw new ActionError("Only published articles can be reviewed.")
    if (post.authorId === user.id) throw new ActionError("You can't rate your own article.")

    const review = await db.articleReview.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      create: { userId: user.id, postId, ...parsed.data },
      update: parsed.data,
    })
    await refreshAggregate(postId)
    return review
  })
}

export async function deleteArticleReview(postId: string) {
  return runAction(async () => {
    const user = await requireUser()
    const { count } = await db.articleReview.deleteMany({ where: { userId: user.id, postId } })
    if (count === 0) throw new ActionError("You haven't reviewed this article.")
    await refreshAggregate(postId)
    return { deleted: true }
  })
}
