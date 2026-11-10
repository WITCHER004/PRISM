import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ProfileClient } from "@/components/discovery/ProfileClient"
import { getFeedPosts } from "@/actions/posts"
import { MOCK_USERS, type Tag } from "@/lib/data"
import { hueStyle } from "@/lib/topics"

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const user = MOCK_USERS.find((u) => u.username === username)
  if (!user) {
    return { title: `@${username} — Prism` }
  }
  return {
    title: `${user.displayName} — Prism`,
    description: user.bio,
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  let user = MOCK_USERS.find((u) => u.username === username)
  if (!user) {
    // Dynamic user profile fallback for newly registered authors/readers
    user = {
      id: `u-${username}`,
      username,
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
      bio: "Curious thinker and reader on Prism.",
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=d1d4f9`,
      role: "WRITER",
      isVerifiedHuman: true,
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
      createdAt: new Date().toISOString(),
    }
  }

  const posts = (await getFeedPosts(30))
    .filter((p) => p.author.username === username && p.status === "PUBLISHED")
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))

  // The writer's topics by how often they write in them; the first one colours the profile
  const counts = new Map<string, { tag: Tag; count: number }>()
  for (const p of posts)
    for (const t of p.tags) counts.set(t.slug, { tag: t, count: (counts.get(t.slug)?.count ?? 0) + 1 })
  const topics = [...counts.values()].sort((a, b) => b.count - a.count).map(({ tag, count }) => ({ ...tag, count }))
  // Lead with the topic of their most recent story when counts tie
  const primary = topics[0]?.slug ?? posts[0]?.tags[0]?.slug

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)]" style={hueStyle(primary)}>
      <SiteHeader />
      <main className="flex-1">
        {/* Cover, washed in the writer's main topic */}
        <div aria-hidden className="relative h-44 sm:h-60 hue-wash overflow-hidden">
          <div className="absolute inset-0 hue-glow" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]" />
        </div>
        <ProfileClient user={user} posts={posts} topics={topics} />
      </main>
      <SiteFooter />
    </div>
  )
}
