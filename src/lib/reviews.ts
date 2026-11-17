// Reader reviews & star ratings: shared types and aggregation. Stored in Firestore `reviews`
// (doc id `{postId}_{uid}`); see useArticleReviews in components/reviews/ArticleReviews.tsx.

export const REVIEW_BODY_MAX = 1000

export interface ArticleReview {
  id: string
  postId: string
  /** Handle of the article's author (lets a profile total its ratings in one query) */
  postAuthor?: string
  /** Username of the reader who wrote it */
  author: string
  rating: number
  body: string
  createdAt: string
  updatedAt?: string
}

export interface ReviewAuthor {
  username: string
  displayName: string
  avatarUrl: string
}

export interface RatingSummary {
  average: number
  count: number
  /** Count per star, index 0 = 1 star */
  distribution: [number, number, number, number, number]
}

export function summarize(reviews: Pick<ArticleReview, "rating">[]): RatingSummary {
  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0]
  let sum = 0
  for (const rev of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(rev.rating)))
    distribution[star - 1]++
    sum += star
  }
  return { average: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : 0, count: reviews.length, distribution }
}

export const reviewKey = (postId: string, username: string) => `${postId}:${username}`

/**
 * Firestore reviews for one article, with this reader's own latest save (or delete: null) applied on
 * top so their edit shows before the write round-trips. One review per reader per article.
 */
export function mergeReviews(postId: string, remote: ArticleReview[], local: Record<string, ArticleReview | null>): ArticleReview[] {
  const byAuthor = new Map(remote.filter((r) => r.postId === postId).map((r) => [r.author, r]))
  for (const [key, rev] of Object.entries(local)) {
    if (!key.startsWith(`${postId}:`)) continue
    const author = key.slice(postId.length + 1)
    if (rev) byAuthor.set(author, rev)
    else byAuthor.delete(author)
  }
  return [...byAuthor.values()].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
}
