"use client"

import { useMemo } from "react"
import type { Post, User } from "@/lib/data"
import { postFromArticle, userFromDoc } from "@/lib/live/schema"
import { useUIStore } from "@/lib/store"

/** Every published story, live from Firestore (newest first), with authors from the users mirror */
export function usePublishedPosts(): Post[] {
  const drafts = useUIStore((s) => s.drafts)
  const users = useUIStore((s) => s.users)
  return useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.live && d.publishedAt && !users[d.authorUsername]?.suspended)
        .map((d) => {
          const u = users[d.authorUsername]
          return postFromArticle(d, u ? userFromDoc(u) : undefined)
        })
        .filter((p): p is Post => !!p)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [drafts, users]
  )
}

/** Every member (not suspended) as a public User, with their published-story count */
export function useMembers(): User[] {
  const users = useUIStore((s) => s.users)
  const posts = usePublishedPosts()
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of posts) counts.set(p.author.username, (counts.get(p.author.username) ?? 0) + 1)
    return Object.values(users)
      .filter((u) => !u.suspended)
      .map((u) => userFromDoc(u, counts.get(u.handle) ?? 0))
  }, [users, posts])
}

/** True until the first Firestore snapshot of articles has arrived */
export const useArticlesLoading = () => !useUIStore((s) => s.live.articles)
