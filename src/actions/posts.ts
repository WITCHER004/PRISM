"use server"

import { db } from "@/lib/db"
import { MOCK_POSTS, type Post } from "@/lib/data"
import { revalidatePath } from "next/cache"
import { generateSlug, estimateReadingTime } from "@/lib/utils"

export async function getFeedPosts(limit = 10): Promise<Post[]> {
  try {
    const posts = await db.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        author: true,
        tags: { include: { tag: true } },
      },
    })

    if (!posts || posts.length === 0) return MOCK_POSTS

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle ?? undefined,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      contentHtml: p.contentHtml,
      coverImageUrl: p.coverImageUrl ?? undefined,
      readingTimeMin: p.readingTimeMin,
      wordCount: p.wordCount,
      status: p.status as any,
      paywallTier: p.paywallTier as any,
      paywallPrice: p.paywallPrice ?? 0,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : p.createdAt.toISOString(),
      tags: p.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, slug: t.tag.slug })),
      author: {
        id: p.author.id,
        username: p.author.username,
        displayName: p.author.displayName,
        bio: p.author.bio ?? "",
        avatarUrl: p.author.avatarUrl ?? "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        role: p.author.role as any,
        isVerifiedHuman: p.author.isVerifiedHuman,
        followerCount: 0,
        followingCount: 0,
        postCount: 1,
        createdAt: p.author.createdAt.toISOString(),
      },
      clapCount: p.clapCount,
      commentCount: p.commentCount,
      bookmarkCount: p.bookmarkCount,
      viewCount: p.viewCount,
      trustScore: p.trustScore,
    }))
  } catch (error) {
    // If DB is offline / not migrated yet, gracefully serve mock data
    return MOCK_POSTS
  }
}

export async function getPostBySlug(username: string, slug: string): Promise<Post | null> {
  try {
    const post = await db.post.findFirst({
      where: {
        slug,
        author: { username },
      },
      include: {
        author: true,
        tags: { include: { tag: true } },
      },
    })

    if (!post) {
      const mock = MOCK_POSTS.find((p) => p.author.username === username && p.slug === slug)
      return mock ?? null
    }

    return {
      id: post.id,
      title: post.title,
      subtitle: post.subtitle ?? undefined,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      contentHtml: post.contentHtml,
      coverImageUrl: post.coverImageUrl ?? undefined,
      readingTimeMin: post.readingTimeMin,
      wordCount: post.wordCount,
      status: post.status as any,
      paywallTier: post.paywallTier as any,
      paywallPrice: post.paywallPrice ?? 0,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : post.createdAt.toISOString(),
      tags: post.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, slug: t.tag.slug })),
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        bio: post.author.bio ?? "",
        avatarUrl: post.author.avatarUrl ?? "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        role: post.author.role as any,
        isVerifiedHuman: post.author.isVerifiedHuman,
        followerCount: 0,
        followingCount: 0,
        postCount: 1,
        createdAt: post.author.createdAt.toISOString(),
      },
      clapCount: post.clapCount,
      commentCount: post.commentCount,
      bookmarkCount: post.bookmarkCount,
      viewCount: post.viewCount,
      trustScore: post.trustScore,
    }
  } catch {
    const mock = MOCK_POSTS.find((p) => p.author.username === username && p.slug === slug)
    return mock ?? null
  }
}

export async function createPostDraft(data: {
  title: string
  subtitle?: string
  contentHtml: string
  paywallTier?: "FREE" | "METERED" | "SUBSCRIBER" | "PAID"
  tags?: string[]
  authorId?: string
}) {
  try {
    const words = data.contentHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length
    const readingTime = estimateReadingTime(data.contentHtml)
    const slug = `${generateSlug(data.title)}-${Date.now().toString(36)}`

    // Fallback author for demo mode
    let authorId = data.authorId
    if (!authorId) {
      const defaultUser = await db.user.upsert({
        where: { username: "alexchen" },
        update: {},
        create: {
          username: "alexchen",
          email: "alex@prism.pub",
          displayName: "Alex Chen",
          bio: "Senior ML Engineer @ Stripe. Distributed systems & AI infrastructure.",
          avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alexchen&backgroundColor=b6e3f4",
          isVerifiedHuman: true,
          role: "WRITER",
        },
      })
      authorId = defaultUser.id
    }

    const post = await db.post.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        slug,
        excerpt: data.subtitle || data.contentHtml.replace(/<[^>]+>/g, " ").slice(0, 160),
        contentHtml: data.contentHtml,
        wordCount: words,
        readingTimeMin: readingTime,
        paywallTier: data.paywallTier ?? "FREE",
        status: "DRAFT",
        authorId,
      },
    })

    revalidatePath("/")
    revalidatePath("/dashboard")
    return { success: true, post }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

