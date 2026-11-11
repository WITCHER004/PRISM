// Reader reviews & star ratings: shared types, sample data and aggregation.

export const REVIEW_BODY_MAX = 1000

export interface ArticleReview {
  id: string
  postId: string
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

/** Readers who left the sample reviews on the demo articles */
export const SAMPLE_READERS: ReviewAuthor[] = [
  { username: "tomasvega", displayName: "Tomás Vega", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=tomasvega&backgroundColor=e2e8f0" },
  { username: "hanaobi", displayName: "Hana Obi", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=hanaobi&backgroundColor=e2e8f0" },
  { username: "leifmartens", displayName: "Leif Martens", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=leifmartens&backgroundColor=e2e8f0" },
  { username: "ameliaross", displayName: "Amelia Ross", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ameliaross&backgroundColor=e2e8f0" },
]

const r = (postId: string, author: string, rating: number, body: string, createdAt: string): ArticleReview => ({
  id: `sr_${postId}_${author}`,
  postId,
  author,
  rating,
  body,
  createdAt,
})

export const SAMPLE_REVIEWS: ArticleReview[] = [
  r("p1", "priyarao", 5, "The clearest explanation of the saga pattern's failure modes I've read. The compensation section alone is worth it.", "2026-10-29T10:00:00.000Z"),
  r("p1", "tomasvega", 4, "Great on the theory. I'd have liked one worked example with real numbers on retry storms.", "2026-10-30T14:20:00.000Z"),
  r("p1", "hanaobi", 5, "Sent this to my whole team before our outbox migration.", "2026-11-01T09:12:00.000Z"),
  r("p2", "alexchen", 5, "Finally, a token naming scheme that survives a rebrand.", "2026-10-27T08:00:00.000Z"),
  r("p2", "leifmartens", 4, "Useful. The Figma variables part moves fast if you haven't used modes before.", "2026-10-28T16:45:00.000Z"),
  r("p3", "sarahkim", 5, "Careful, well-sourced and fair to both sides.", "2026-10-25T11:30:00.000Z"),
  r("p3", "ameliaross", 4, "Strong reporting. The ending felt a little abrupt.", "2026-10-26T19:05:00.000Z"),
  r("p3", "tomasvega", 3, "Good context, but I wanted more on what the EU drafts actually say.", "2026-10-27T07:40:00.000Z"),
  r("p4", "marcuswilliams", 5, "Beautifully written. I understand ice cores now.", "2026-10-24T13:00:00.000Z"),
  r("p4", "hanaobi", 5, "The bit about bubbles as tiny archives of air stayed with me all day.", "2026-10-25T21:10:00.000Z"),
  r("p5", "alexchen", 4, "Sharp framing of discovery as a product decision, not an ML one.", "2026-10-22T09:30:00.000Z"),
  r("p6", "priyarao", 5, "Should be required reading for anyone choosing a framework this year.", "2026-10-20T12:00:00.000Z"),
  r("p6", "leifmartens", 4, "Agree with most of it. Boring tech is underrated.", "2026-10-21T18:25:00.000Z"),
]

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
 * Sample reviews merged with ones written in this browser. A local review replaces the sample
 * one by the same reader, so each reader counts once per article.
 */
export function mergeReviews(postId: string, local: Record<string, ArticleReview | null>): ArticleReview[] {
  const mine: ArticleReview[] = []
  // null = deleted; still hides the sample review by that reader
  const overridden = new Set<string>()
  for (const [key, rev] of Object.entries(local)) {
    if (!key.startsWith(`${postId}:`)) continue
    overridden.add(key.slice(postId.length + 1))
    if (rev) mine.push(rev)
  }
  return [...mine, ...SAMPLE_REVIEWS.filter((rev) => rev.postId === postId && !overridden.has(rev.author))].sort((a, b) =>
    (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
  )
}
