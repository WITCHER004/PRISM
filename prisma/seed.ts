import { PrismaClient } from "@prisma/client"
import { MOCK_USERS, MOCK_TAGS, MOCK_POSTS } from "../src/lib/data"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // 1. Seed Tags
  for (const tag of MOCK_TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      },
    })
  }

  // 2. Seed Users
  for (const user of MOCK_USERS) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        headerImageUrl: user.headerImageUrl,
        twitterHandle: user.twitterHandle,
        githubHandle: user.githubHandle,
        role: user.role,
        isVerifiedHuman: user.isVerifiedHuman,
      },
      create: {
        id: user.id,
        username: user.username,
        email: `${user.username}@prism.pub`,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        headerImageUrl: user.headerImageUrl,
        twitterHandle: user.twitterHandle,
        githubHandle: user.githubHandle,
        role: user.role,
        isVerifiedHuman: user.isVerifiedHuman,
      },
    })
  }

  // 3. Seed Posts
  for (const post of MOCK_POSTS) {
    const createdPost = await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        contentHtml: post.contentHtml,
        coverImageUrl: post.coverImageUrl,
        readingTimeMin: post.readingTimeMin,
        wordCount: post.wordCount,
        status: post.status,
        paywallTier: post.paywallTier,
        paywallPrice: post.paywallPrice ?? 0,
        publishedAt: new Date(post.publishedAt),
        clapCount: post.clapCount,
        commentCount: post.commentCount,
        bookmarkCount: post.bookmarkCount,
        viewCount: post.viewCount,
        trustScore: post.trustScore,
      },
      create: {
        id: post.id,
        authorId: post.author.id,
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        excerpt: post.excerpt,
        contentHtml: post.contentHtml,
        coverImageUrl: post.coverImageUrl,
        readingTimeMin: post.readingTimeMin,
        wordCount: post.wordCount,
        status: post.status,
        paywallTier: post.paywallTier,
        paywallPrice: post.paywallPrice ?? 0,
        publishedAt: new Date(post.publishedAt),
        clapCount: post.clapCount,
        commentCount: post.commentCount,
        bookmarkCount: post.bookmarkCount,
        viewCount: post.viewCount,
        trustScore: post.trustScore,
      },
    })

    // Link Tags
    for (const tag of post.tags) {
      await prisma.postTag.upsert({
        where: {
          postId_tagId: {
            postId: createdPost.id,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          postId: createdPost.id,
          tagId: tag.id,
        },
      })
    }
  }

  console.log("✅ Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

