import { PrismaClient } from "@prisma/client"
import { ALL_ACCOUNTS, MOCK_TAGS, MOCK_POSTS } from "../src/lib/data"
import { SEED_BADGES, SEED_SUBSCRIPTIONS } from "../src/lib/elite/demo"

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

  // 2. Seed Users (writers, staff and the 10-member peer panel)
  for (const user of ALL_ACCOUNTS) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        headerImageUrl: user.headerImageUrl,
        twitterHandle: user.twitterHandle,
        githubHandle: user.githubHandle,
        linkedinHandle: user.linkedinHandle,
        instagramHandle: user.instagramHandle,
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
        linkedinHandle: user.linkedinHandle,
        instagramHandle: user.instagramHandle,
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

  // 4. Elite tier: seeded subscriptions + badges (e.g. priyarao starts on Elite)
  for (const [username, sub] of Object.entries(SEED_SUBSCRIPTIONS)) {
    const user = await prisma.user.update({
      where: { username },
      data: {
        tier: sub.tier,
        subscriptionStatus: sub.subscriptionStatus,
        subscribedAt: sub.subscribedAt ? new Date(sub.subscribedAt) : null,
        expiresAt: sub.expiresAt ? new Date(sub.expiresAt) : null,
        subscriptionProvider: sub.provider,
        subscriptionRef: sub.reference,
      },
    })
    const badges = ["ELITE_AUTHOR" as const, ...(SEED_BADGES[username] ?? [])]
    await prisma.userBadge.createMany({ data: badges.map((badge) => ({ userId: user.id, badge })), skipDuplicates: true })
    await prisma.writerWallet.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
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

