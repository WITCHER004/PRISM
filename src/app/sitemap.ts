import type { MetadataRoute } from "next"
import { getFeedPosts } from "@/actions/posts"
import { MOCK_TAGS, MOCK_USERS } from "@/lib/data"
import { absoluteUrl } from "@/lib/seo"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ["/", "/about", "/explore", "/membership", "/terms", "/privacy", "/content-policy"]
  const posts = await getFeedPosts(1000)

  return [
    ...staticPages.map((path) => ({ url: absoluteUrl(path) })),
    ...MOCK_TAGS.map((tag) => ({ url: absoluteUrl(`/explore/${tag.slug}`) })),
    ...MOCK_USERS.map((user) => ({ url: absoluteUrl(`/${user.username}`) })),
    ...posts.filter((post) => post.status === "PUBLISHED").map((post) => ({
      url: absoluteUrl(`/${post.author.username}/${post.slug}`),
      lastModified: new Date(post.publishedAt),
    })),
  ]
}
