// "More like this": content-based ranking over published articles. Pure (no SDK), so the server
// article page and the client story page share it.
//
//   same primary topic              +50
//   title/subtitle/tag token overlap +30 × Jaccard similarity (stop words removed)
//   same author                     +15
//   engagement + recency             +5 (views and likes relative to the pool, decaying over 90 days)

import type { Post } from "@/lib/data"

const STOP = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its " +
    "just more most my no not of on or our out over so than that the their them then there these they this " +
    "those to too up us very was we were what when where which who why will with would you your about after " +
    "again against all also any because before being between both down during each few further here him his " +
    "her hers itself me myself new now off once only other own same she should some such through under until " +
    "while yours yourself one two get got make made like way ways thing things really much many every"
  ).split(" ")
)

export function tokens(...parts: (string | undefined)[]): Set<string> {
  const out = new Set<string>()
  for (const part of parts) {
    for (const raw of (part ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 3 || STOP.has(raw) || /^\d+$/.test(raw)) continue
      // Light stemming so "systems"/"system" and "designing"/"design" meet
      out.add(raw.replace(/(ings|ing|ies|es|s)$/, (m) => (m === "ies" ? "y" : "")) || raw)
    }
  }
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export interface Recommendation {
  post: Post
  score: number
  reason: string
}

const DAY = 86_400_000

export function recommend(current: Pick<Post, "id" | "title" | "subtitle" | "tags" | "author">, pool: Post[], n = 3, now = Date.now()): Recommendation[] {
  const candidates = pool.filter((p) => p.id !== current.id)
  if (!candidates.length) return []
  const topic = current.tags[0]
  const mine = tokens(current.title, current.subtitle, ...current.tags.map((t) => t.name))
  const maxEngagement = Math.max(1, ...candidates.map((p) => Math.log1p(p.viewCount + p.clapCount)))

  return candidates
    .map((p) => {
      const sameTopic = !!topic && p.tags[0]?.slug === topic.slug
      const overlap = jaccard(mine, tokens(p.title, p.subtitle, ...p.tags.map((t) => t.name)))
      const sameAuthor = p.author.username === current.author.username
      const engagement = Math.log1p(p.viewCount + p.clapCount) / maxEngagement
      const age = Math.max(0, now - Date.parse(p.publishedAt)) / DAY
      const recency = Math.exp(-age / 90)
      const score = (sameTopic ? 50 : 0) + overlap * 30 + (sameAuthor ? 15 : 0) + engagement * 2.5 + recency * 2.5
      const reason = sameTopic
        ? `Same topic · ${topic!.name}`
        : sameAuthor
          ? "By the same author"
          : overlap > 0
            ? "Related concepts"
            : "Popular on Prism"
      return { post: p, score, reason }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}
