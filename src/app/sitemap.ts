import type { MetadataRoute } from "next"
import { getActiveWriters, getPublishedPosts } from "@/lib/server/content"
import { TOPICS } from "@/lib/topics"
import { absoluteUrl } from "@/lib/seo"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ["/", "/about", "/explore", "/elite", "/membership", "/terms", "/privacy", "/content-policy"]
  const [posts, writers] = await Promise.all([getPublishedPosts(), getActiveWriters(5000)])

  return [
    ...staticPages.map((path) => ({ url: absoluteUrl(path) })),
    ...TOPICS.map((tag) => ({ url: absoluteUrl(`/explore/${tag.slug}`) })),
    ...writers.map((user) => ({ url: absoluteUrl(`/${user.username}`) })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/${post.author.username}/${post.slug}`),
      lastModified: new Date(post.publishedAt),
    })),
  ]
}
