import Link from "next/link"
import type { Metadata } from "next"
import { ArrowUpRight, Compass } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Reveal } from "@/components/motion/Reveal"
import { ExploreFeed } from "@/components/discovery/ExploreFeed"
import { FollowedTopicMark } from "@/components/discovery/TopicFollowButton"
import { getFeedPosts } from "@/actions/posts"
import { MOCK_TAGS } from "@/lib/data"
import { numberWithCommas } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Department Index & Archives — The Prism",
  description: "Browse the complete archive of independent investigations, technical essays, and dispatches.",
}

export default async function ExplorePage() {
  const posts = await getFeedPosts(30)
  const topics = [...MOCK_TAGS].sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0))

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)] font-serif">
      <SiteHeader />
      <main className="flex-1">
        {/* Head */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[var(--accent)] font-bold mb-2">
            <Compass className="w-4 h-4" />
            <span>EDITORIAL DESKS &amp; SUBJECT CLASSIFICATION</span>
          </div>
          <h1 className="font-serif font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[var(--fg)]">
            The Department Index
          </h1>
          <p className="mt-3 max-w-2xl text-base sm:text-lg font-serif italic text-[var(--fg-muted)]">
            Explore {MOCK_TAGS.length} curated editorial subjects, comprehensive investigative series, and direct writer dispatches.
          </p>
        </section>

        {/* Topic grid */}
        <section aria-labelledby="topics-title" className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <SectionTitle id="topics-title" title="Classified Desks" />
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {topics.map((tag, i) => (
              <Reveal as="li" key={tag.id} index={i}>
                <Link
                  href={`/explore/${tag.slug}`}
                  className="group relative flex flex-col h-full min-h-[120px] p-4 border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)] transition-colors duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent)] font-bold">
                      SEC. {String(i + 1).padStart(2, "0")}
                    </span>
                    <FollowedTopicMark slug={tag.slug} />
                  </div>
                  <span className="mt-auto pt-4 font-serif font-bold text-base sm:text-lg leading-tight text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                    {tag.name}
                  </span>
                  <span className="mt-1 flex items-center justify-between font-mono text-xs text-[var(--fg-muted)] uppercase">
                    {numberWithCommas(tag.postCount ?? 0)} DISPATCHES
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Stories */}
        <section aria-labelledby="stories-title" className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 border-t border-[var(--border)] pt-10">
          <SectionTitle id="stories-title" title="Dispatches From All Desks" />
          <ExploreFeed posts={posts} topics={MOCK_TAGS} />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-6 pb-2 border-b-2 border-[var(--border-strong)]">
      <h2 id={id} className="font-serif font-black text-2xl sm:text-3xl uppercase tracking-tight text-[var(--fg)]">
        {title}
      </h2>
      <span className="font-mono text-xs uppercase tracking-widest text-[var(--fg-muted)]">
        CURRENT WIRE
      </span>
    </div>
  )
}
