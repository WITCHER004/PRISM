import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Reveal } from "@/components/motion/Reveal"
import { ExploreFeed } from "@/components/discovery/ExploreFeed"
import { FollowedTopicMark } from "@/components/discovery/TopicFollowButton"
import { getFeedPosts } from "@/actions/posts"
import { MOCK_TAGS } from "@/lib/data"
import { hueStyle } from "@/lib/topics"
import { numberWithCommas } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Explore — Prism",
  description: "Discover the best stories across every topic.",
}

export default async function ExplorePage() {
  const posts = await getFeedPosts(30)
  const topics = [...MOCK_TAGS].sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0))

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        {/* Head */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
          <p className="meta">Explore · {MOCK_TAGS.length} topics</p>
          <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem]">
            Every topic, <span className="spectrum-text">one spectrum.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--fg-muted)]">
            Wander by subject, or see what readers are passing around right now.
          </p>
        </section>

        {/* Topic grid */}
        <section aria-labelledby="topics-title" className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <SectionTitle id="topics-title" title="Browse topics" />
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {topics.map((tag, i) => (
              <Reveal as="li" key={tag.id} index={i}>
                <Link
                  href={`/explore/${tag.slug}`}
                  style={hueStyle(tag.slug)}
                  className="group relative flex flex-col h-full min-h-[132px] p-4 rounded-[var(--radius-card)] hue-wash border border-transparent hover:hue-border shadow-[var(--shadow)] hover:shadow-[var(--shadow-lift)] transition-[box-shadow,border-color] duration-300 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="w-3 h-3 mt-1 rounded-full hue-dot transition-transform duration-300 group-hover:scale-150" />
                    <FollowedTopicMark slug={tag.slug} />
                  </div>
                  <span className="mt-auto pt-6 font-display font-semibold text-[1.0625rem] leading-tight tracking-[-0.015em] hue-ink">
                    {tag.name}
                  </span>
                  <span className="mt-1 flex items-center justify-between meta">
                    {numberWithCommas(tag.postCount ?? 0)} stories
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-200" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Stories */}
        <section aria-labelledby="stories-title" className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <SectionTitle id="stories-title" title="Stories worth your time" />
          <ExploreFeed posts={posts} topics={MOCK_TAGS} />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h2 id={id} className="display text-[1.75rem] sm:text-[2.25rem]">
        {title}
      </h2>
    </div>
  )
}
