import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ProfileClient } from "@/components/discovery/ProfileClient"
import type { Tag, User } from "@/lib/data"
import { getPublishedPosts, getUserByHandle } from "@/lib/server/content"
import { hueStyle } from "@/lib/topics"
import { JsonLd } from "@/components/seo/JsonLd"
import { absoluteUrl, breadcrumbList, pageMetadata, truncateDescription } from "@/lib/seo"

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export const revalidate = 60

/**
 * A profile exists if a users/{uid} document claims the handle. Anything else is a 404: this route
 * catches every top-level path, so inventing a profile for unknown names would turn any typo
 * (or /manifest.webmanifest) into an indexable page.
 */
async function findWriter(username: string): Promise<User | null> {
  return getUserByHandle(username)
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const user = await findWriter(username)
  if (!user) return { title: "Page not found", robots: { index: false } }
  return pageMetadata({
    title: `${user.displayName}: essays and stories`,
    description: truncateDescription(user.bio),
    path: `/${user.username}`,
    socialTitle: `${user.displayName} on Prism`,
    type: "profile",
  })
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const user = await findWriter(username)
  if (!user) notFound()

  const posts = (await getPublishedPosts())
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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ProfilePage",
              url: absoluteUrl(`/${user.username}`),
              dateCreated: user.createdAt,
              mainEntity: {
                "@type": "Person",
                "@id": `${absoluteUrl(`/${user.username}`)}#person`,
                name: user.displayName,
                alternateName: `@${user.username}`,
                description: truncateDescription(user.bio),
                image: user.avatarUrl,
                url: absoluteUrl(`/${user.username}`),
                interactionStatistic: {
                  "@type": "InteractionCounter",
                  interactionType: "https://schema.org/FollowAction",
                  userInteractionCount: user.followerCount,
                },
              },
            },
            breadcrumbList([
              { name: "Home", path: "/" },
              { name: user.displayName, path: `/${user.username}` },
            ]),
          ],
        }}
      />
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
