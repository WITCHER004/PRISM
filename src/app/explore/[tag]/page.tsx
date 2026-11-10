import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, BadgeCheck, Feather } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { PostCard } from "@/components/posts/PostCard"
import { Reveal } from "@/components/motion/Reveal"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { TopicFollowButton } from "@/components/discovery/TopicFollowButton"
import { EmptyState } from "@/components/discovery/EmptyState"
import { getFeedPosts } from "@/actions/posts"
import { MOCK_TAGS, type Tag, type User } from "@/lib/data"
import { hueStyle } from "@/lib/topics"
import { numberWithCommas } from "@/lib/utils"
import { socialImageUrl } from "@/lib/seo"

interface TagPageProps {
  params: Promise<{ tag: string }>
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag: tagSlug } = await params
  const tag = MOCK_TAGS.find((t) => t.slug === tagSlug)
  if (!tag) return { title: "Topic not found — Prism" }
  const title = `${tag.name} stories`
  const description = `Discover the best ${tag.name} stories on Prism.`
  return {
    title: tag.name,
    description,
    alternates: { canonical: `/explore/${tag.slug}` },
    openGraph: {
      title,
      description,
      images: [socialImageUrl(title, description)],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImageUrl(title, description)],
    },
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag: tagSlug } = await params
  const tag = MOCK_TAGS.find((t) => t.slug === tagSlug)
  if (!tag) notFound()

  const all = await getFeedPosts(30)
  const tagPosts = all
    .filter((p) => p.tags.some((t) => t.slug === tag.slug))
    .sort((a, b) => b.clapCount - a.clapCount)

  // Related = topics that share stories with this one, then the biggest of the rest
  const coCount = new Map<string, number>()
  for (const p of tagPosts) for (const t of p.tags) if (t.slug !== tag.slug) coCount.set(t.slug, (coCount.get(t.slug) ?? 0) + 1)
  const related: Tag[] = [
    ...MOCK_TAGS.filter((t) => coCount.has(t.slug)).sort((a, b) => coCount.get(b.slug)! - coCount.get(a.slug)!),
    ...MOCK_TAGS.filter((t) => t.slug !== tag.slug && !coCount.has(t.slug)).sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0)),
  ].slice(0, 6)

  const writers = [...new Map(tagPosts.map((p) => [p.author.username, p.author] as [string, User])).values()]

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)]" style={hueStyle(tag.slug)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] hue-glow" />
      <SiteHeader />
      <main className="relative flex-1">
        {/* Topic head */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-10">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 h-10 -ml-1 px-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All topics
          </Link>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="meta inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full hue-dot" /> Topic
              </p>
              <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem] hue-ink">{tag.name}</h1>
              <p className="mt-3 text-[var(--fg-muted)]">
                <span className="font-medium text-[var(--fg)]">{numberWithCommas(tag.postCount ?? 0)}</span> stories ·{" "}
                <span className="font-medium text-[var(--fg)]">{writers.length}</span>{" "}
                {writers.length === 1 ? "featured writer" : "featured writers"}
              </p>
            </div>
            <TopicFollowButton slug={tag.slug} name={tag.name} className="self-start sm:self-auto" />
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
          {/* Stories */}
          <section aria-labelledby="topic-stories">
            <h2 id="topic-stories" className="display text-[1.75rem] sm:text-[2.25rem] mb-5">
              Top in {tag.name}
            </h2>
            {tagPosts.length > 0 ? (
              tagPosts.map((post, i) => (
                <Reveal key={post.id} index={i}>
                  <PostCard post={post} />
                </Reveal>
              ))
            ) : (
              <EmptyState
                icon={Feather}
                title="This corner is still quiet"
                body={`No one has published in ${tag.name} yet. Follow the topic to hear when they do, or be the first to write here.`}
                cta={{ label: "Write the first story", href: "/editor/new" }}
                secondary={{ label: "Explore other topics", href: "/explore" }}
              />
            )}
          </section>

          {/* Rail */}
          <aside className="space-y-6 lg:sticky lg:top-24 self-start">
            {writers.length > 0 && (
              <div className="panel p-5 shadow-[var(--shadow)]">
                <h2 className="font-display font-semibold text-lg tracking-tight">Writers in {tag.name}</h2>
                <ul className="mt-4 space-y-4">
                  {writers.map((w) => (
                    <li key={w.username} className="flex items-center gap-3">
                      <Link href={`/${w.username}`} className="shrink-0" aria-label={w.displayName}>
                        <Avatar src={w.avatarUrl} alt={w.displayName} size="md" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/${w.username}`} className="flex items-center gap-1 text-sm font-medium hover:underline">
                          <span className="truncate">{w.displayName}</span>
                          {w.isVerifiedHuman && <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" aria-label="Verified writer" />}
                        </Link>
                        <p className="meta mt-0.5">{numberWithCommas(w.followerCount)} readers</p>
                      </div>
                      <FollowButton username={w.username} displayName={w.displayName} size="sm" tone="outline" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="panel p-5 shadow-[var(--shadow)]">
              <h2 className="font-display font-semibold text-lg tracking-tight">Related topics</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {related.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/explore/${t.slug}`}
                    style={hueStyle(t.slug)}
                    className="inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg-secondary)] hover:hue-wash hover:hue-ink hover:border-transparent transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full hue-dot" />
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
