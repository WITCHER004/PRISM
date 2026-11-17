// Published-content reads for server components. Firestore is the only source (src/lib/server/content.ts).
import "server-only"
import type { Post } from "@/lib/data"
import { getPostBySlug as readPostBySlug, getPublishedPosts } from "@/lib/server/content"

export async function getFeedPosts(limit = 10): Promise<Post[]> {
  return (await getPublishedPosts()).slice(0, limit)
}

export async function getPostBySlug(username: string, slug: string): Promise<Post | null> {
  return readPostBySlug(username, slug)
}
