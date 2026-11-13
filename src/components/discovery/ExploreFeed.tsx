"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { Flame, Clock, MessageCircle, X } from "lucide-react"
import type { Post, Tag } from "@/lib/data"
import { PostCard } from "@/components/posts/PostCard"
import { PillTabs } from "./PillTabs"
import { hueStyle } from "@/lib/topics"
import { dur, ease, spring, stagger } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { EliteSpark } from "@/components/papers/ElitePaper"

type Sort = "trending" | "newest" | "discussed"

const SORTS: { id: Sort; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "trending", label: "Trending", icon: Flame },
  { id: "newest", label: "Newest", icon: Clock },
  { id: "discussed", label: "Most discussed", icon: MessageCircle },
]

// Engagement weighted by how much attention each signal costs the reader
const trendScore = (p: Post) => p.clapCount + p.commentCount * 8 + p.bookmarkCount * 3

const sorters: Record<Sort, (a: Post, b: Post) => number> = {
  trending: (a, b) => trendScore(b) - trendScore(a),
  newest: (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  discussed: (a, b) => b.commentCount - a.commentCount,
}

// "papers" is the Advanced Papers filter; any other value is a topic slug
const PAPERS = "papers"

export function ExploreFeed({ posts, topics, initialFilter }: { posts: Post[]; topics: Tag[]; initialFilter?: string }) {
  const [sort, setSort] = useState<Sort>("trending")
  const [topic, setTopic] = useState<string | null>(initialFilter ?? null)
  const paperCount = useMemo(() => posts.filter((p) => p.paper).length, [posts])

  // Only offer chips for topics that have stories, with their counts
  const chips = useMemo(
    () =>
      topics
        .map((t) => ({ ...t, count: posts.filter((p) => p.tags.some((pt) => pt.slug === t.slug)).length }))
        .filter((t) => t.count > 0),
    [posts, topics]
  )

  const visible = useMemo(
    () =>
      posts
        .filter((p) => !topic || (topic === PAPERS ? !!p.paper : p.tags.some((t) => t.slug === topic)))
        .sort(sorters[sort]),
    [posts, topic, sort]
  )

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="shrink-0">
          <PillTabs label="Sort stories" tabs={SORTS} value={sort} onChange={setSort} />
        </div>

        <LayoutGroup id="explore-chips">
          <div
            role="group"
            aria-label="Filter by topic"
            className="min-w-0 flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 lg:pb-0"
          >
            <Chip active={topic === null} onClick={() => setTopic(null)}>
              All
              <span className="font-mono text-[0.6875rem] opacity-60 tabular-nums">{posts.length}</span>
            </Chip>
            {paperCount > 0 && (
              <Chip active={topic === PAPERS} onClick={() => setTopic(topic === PAPERS ? null : PAPERS)} elite>
                <EliteSpark className="w-3 h-3 text-[var(--elite-ink)]" />
                Advanced Papers
                <span className="font-mono text-[0.6875rem] opacity-60 tabular-nums">{paperCount}</span>
              </Chip>
            )}
            {chips.map((t) => (
              <Chip key={t.slug} active={topic === t.slug} onClick={() => setTopic(topic === t.slug ? null : t.slug)} slug={t.slug}>
                <span className="w-2 h-2 rounded-full hue-dot" />
                {t.name}
                <span className="font-mono text-[0.6875rem] opacity-60 tabular-nums">{t.count}</span>
              </Chip>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "story" : "stories"}
      </p>

      <motion.div layout className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((post, i) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.out, delay: i * stagger } }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: dur.fast, ease: ease.in } }}
              transition={{ layout: spring.soft }}
              className="h-full"
            >
              <PostCard post={post} variant="tile" />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {topic && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.base, ease: ease.out }}
          className="mt-6 flex justify-center"
        >
          <button
            type="button"
            onClick={() => setTopic(null)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-colors"
          >
            <X className="w-3.5 h-3.5" /> {topic === PAPERS ? "Show all stories" : "Clear topic filter"}
          </button>
        </motion.div>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  slug,
  elite,
  children,
}: {
  active: boolean
  onClick: () => void
  slug?: string
  /** Advanced Papers chip: gold wash when active */
  elite?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={slug ? hueStyle(slug) : undefined}
      className={cn(
        "relative shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full border text-sm transition-colors",
        active
          ? "border-transparent text-[var(--fg)]"
          : "border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
      )}
    >
      {active && (
        <motion.span
          layoutId="chip"
          transition={spring.snappy}
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full",
            slug ? "hue-wash" : elite ? "bg-[var(--elite-wash)] ring-1 ring-inset ring-[var(--elite-line)]" : "bg-[var(--surface)]"
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex items-center gap-2",
          active && slug && "hue-ink font-medium",
          active && elite && "text-[var(--elite-ink)] font-medium"
        )}
      >
        {children}
      </span>
    </button>
  )
}
