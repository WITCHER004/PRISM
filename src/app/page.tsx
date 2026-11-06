import { BroadsheetMasthead } from "@/components/broadsheet/BroadsheetMasthead"
import { BroadsheetFooter } from "@/components/broadsheet/BroadsheetFooter"
import { PostCard } from "@/components/posts/PostCard"
import { getFeedPosts } from "@/actions/posts"
import { MOCK_TAGS } from "@/lib/data"
import Link from "next/link"
import { ArrowRight, Flame, Newspaper } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "The Prism — Long-form Journalism & Independent Ideas",
  description:
    "An editorial publication for independent inquiry, technical depth, and creator autonomy. Published without algorithmic interference or walled gardens.",
}

export default async function HomePage() {
  const posts = await getFeedPosts(12)
  const leadStory = posts[0]
  const dispatchRail = posts.slice(1, 5)
  const belowFoldStories = posts.slice(5, 11)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)] font-serif">
      {/* ── 1. Broadsheet Masthead ── */}
      <BroadsheetMasthead />

      {/* ── 2. Top Curated Topic Rail ── */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-0.5">
            <span className="shrink-0 font-bold uppercase tracking-wider text-[var(--accent)] text-[11px]">
              TRENDING TOPICS:
            </span>
            {MOCK_TAGS.slice(0, 6).map((tag) => (
              <Link
                key={tag.id}
                href={`/explore/${tag.slug}`}
                className="shrink-0 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline uppercase transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[var(--fg-subtle)] shrink-0">
            <Link href="/explore" className="text-[var(--fg-secondary)] hover:text-[var(--accent)] font-semibold flex items-center gap-1">
              <span>View All Desks</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1">
        {/* ── 3. Above the Fold: 12-Column Asymmetric Grid ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Columns 1-8: Primary Lead Story */}
            <div className="lg:col-span-8 lg:pr-8">
              {leadStory ? (
                <PostCard post={leadStory} variant="hero" />
              ) : (
                <div className="p-12 text-center text-[var(--fg-muted)] font-mono text-sm">
                  Loading lead dispatch...
                </div>
              )}
            </div>

            {/* Columns 9-12: The Op-Ed & Dispatch Rail */}
            <div className="lg:col-span-4 lg:pl-8 lg:border-l lg:border-[var(--border)] flex flex-col">
              {/* Rail Header */}
              <div className="pb-2 mb-4 border-b-2 border-[var(--border-strong)] flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-widest font-black text-[var(--fg)] flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>DISPATCHES &amp; OPINION</span>
                </h3>
                <span className="text-[10px] font-mono text-[var(--fg-subtle)] uppercase">DESK II</span>
              </div>

              {/* Stacked Vertical Articles */}
              <div className="divide-y divide-[var(--border)] flex-1">
                {dispatchRail.map((post, idx) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    variant="compact"
                    index={idx + 1}
                  />
                ))}
              </div>

              {/* Reader Notice Module */}
              <div className="mt-6 pt-4 border-t-2 border-[var(--border-strong)] bg-[var(--surface)] p-4 border border-[var(--border)]">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] font-bold block mb-1">
                  ABOUT THIS PUBLICATION
                </span>
                <p className="font-serif text-xs leading-relaxed text-[var(--fg-secondary)]">
                  The Prism is funded directly by readers. Writers own their audience and publish without algorithmic sorting or invasive tracking.
                </p>
                <Link
                  href="/about"
                  className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider font-bold text-[var(--fg)] hover:text-[var(--accent)] hover:underline"
                >
                  Read our Publishing Charter &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Editorial Pull Quote Section (Grounded & Purposeful) ── */}
        <section className="border-t border-b border-[var(--border-strong)] bg-[var(--bg-secondary)] my-8 py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)] font-bold block mb-3">
              EDITORIAL PERSPECTIVE
            </span>

            <blockquote className="font-serif text-xl sm:text-2xl md:text-3xl font-medium leading-snug text-[var(--fg)]">
              &ldquo;Software architecture and deep technical journalism require patience, rigor, and direct accountability to the reader.&rdquo;
            </blockquote>

            <div className="mt-4 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
              <span className="text-[var(--fg)] font-bold">The Prism Editorial Board</span>
            </div>
          </div>
        </section>

        {/* ── 5. Below the Fold: 3-Column Broadsheet Grid ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          {/* Section Masthead Rule */}
          <div className="mb-8 border-b-2 border-[var(--border-strong)] pb-2 flex items-baseline justify-between">
            <div className="flex items-center gap-3">
              <Newspaper className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="font-serif text-2xl sm:text-3xl font-black uppercase tracking-tight text-[var(--fg)]">
                Selected Features &amp; Essays
              </h2>
            </div>
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--fg-muted)]">
              ARCHIVE SECTION B
            </span>
          </div>

          {/* 3 Traditional Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {belowFoldStories.map((post) => (
              <PostCard key={post.id} post={post} variant="tile" />
            ))}
          </div>
        </section>

        {/* ── 6. Department Index / Topic Rail ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-[var(--border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--fg-muted)] font-bold">
              DEPARTMENT DIRECTORY:
            </span>
            <div className="flex flex-wrap gap-2 text-xs font-mono uppercase">
              {MOCK_TAGS.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/explore/${tag.slug}`}
                  className="px-2.5 py-1 border border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── 7. Broadsheet Edition Footer ── */}
      <BroadsheetFooter />
    </div>
  )
}
