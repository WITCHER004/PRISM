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

export function ExploreFeed({ posts, topics }: { posts: Post[]; topics: Tag[] }) {
  const [sort, setSort] = useState<Sort>("trending")
  const [topic, setTopic] = useState<string | null>(null)

  // Only offer chips for topics that have stories, with their counts
  const chips = useMemo(
    () =>
      topics
        .map((t) => ({ ...t, count: posts.filter((p) => p.tags.some((pt) => pt.slug === t.slug)).length }))
        .filter((t) => t.count > 0),
    [posts, topics]
  )

  const visible = useMemo(
    () => posts.filter((p) => !topic || p.tags.some((t) => t.slug === topic)).sort(sorters[sort]),
    [posts, topic, sort]
  )

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <PillTabs label="Sort stories" tabs={SORTS} value={sort} onChange={setSort} />

        <LayoutGroup id="explore-chips">
          <div
            role="group"
            aria-label="Filter by topic"
            className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 lg:pb-0"
          >
            <Chip active={topic === null} onClick={() => setTopic(null)}>
              All
              <span className="font-mono text-[0.6875rem] opacity-60 tabular-nums">{posts.length}</span>
            </Chip>
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
            <X className="w-3.5 h-3.5" /> Clear topic filter
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
  children,
}: {
  active: boolean
  onClick: () => void
  slug?: string
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
          className={cn("absolute inset-0 rounded-full", slug ? "hue-wash" : "bg-[var(--surface)]")}
        />
      )}
      <span className={cn("relative inline-flex items-center gap-2", active && slug && "hue-ink font-medium")}>{children}</span>
    </button>
  )
}
