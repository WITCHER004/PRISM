"use client"

import Link from "next/link"
import { useMemo } from "react"
import { motion } from "motion/react"
import { BarChart3, Eye, FileText, Hand, Percent } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { PageHead, StatTile, usePublishedBy, useWriter } from "@/components/studio/studio-ui"
import { useHydrated } from "@/components/studio/useHydrated"
import { hueStyle } from "@/lib/topics"
import { dur, ease } from "@/lib/motion"
import { formatDate, numberWithCommas } from "@/lib/utils"

// Lifetime numbers from each published article's Firestore counters (views: unique reads, likes: claps).
export default function AnalyticsPage() {
  const hydrated = useHydrated()
  const { user } = useWriter()
  const posts = usePublishedBy(user.username)

  const totals = useMemo(() => {
    const views = posts.reduce((a, p) => a + p.viewCount, 0)
    const claps = posts.reduce((a, p) => a + p.clapCount, 0)
    return { views, claps, perStory: posts.length ? Math.round(views / posts.length) : 0, clapRate: views ? (claps / views) * 100 : 0 }
  }, [posts])

  const ranked = useMemo(() => [...posts].sort((a, b) => b.viewCount - a.viewCount), [posts])
  const max = ranked[0]?.viewCount || 1

  return (
    <>
      <PageHead title="Analytics" lede="How your published stories are landing: unique reads and claps, counted live." />

      <section aria-label="Key numbers" className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile label="Reads" icon={Eye} value={numberWithCommas(totals.views)} sub={<span>Unique readers, all time</span>} />
        <StatTile label="Claps" icon={Hand} value={numberWithCommas(totals.claps)} sub={<span>From readers</span>} />
        <StatTile label="Published" icon={FileText} value={posts.length} sub={<span>{numberWithCommas(totals.perStory)} reads per story</span>} />
        <StatTile label="Clap rate" icon={Percent} value={`${totals.clapRate.toFixed(1)}%`} sub={<span>Claps per 100 reads</span>} />
      </section>

      <Reveal as="section" className="mt-6 panel p-5 sm:p-7">
        <h2 className="display text-[1.5rem]">Your stories by reads</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Every published story, most-read first</p>

        {!hydrated ? (
          <div className="mt-6 h-40 rounded-[14px] bg-[var(--surface)] animate-pulse" aria-hidden />
        ) : ranked.length === 0 ? (
          <div className="mt-8 py-10 text-center">
            <BarChart3 className="mx-auto w-6 h-6 text-[var(--fg-subtle)]" />
            <p className="mt-3 font-medium">Nothing published yet</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Numbers appear here once a story passes review and readers find it.</p>
            <Link
              href="/editor/new"
              className="mt-5 inline-flex items-center h-10 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
            >
              Write a story
            </Link>
          </div>
        ) : (
          <ol className="mt-6 space-y-5">
            {ranked.map((p, i) => (
              <li key={p.id} style={hueStyle(p.tags[0]?.slug)}>
                <div className="flex items-baseline justify-between gap-4">
                  <Link href={`/${p.author.username}/${p.slug}`} className="min-w-0 text-sm font-medium line-clamp-1 hover:underline underline-offset-2">
                    <span className="meta mr-2">{String(i + 1).padStart(2, "0")}</span>
                    {p.title}
                  </Link>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold">{numberWithCommas(p.viewCount)}</span>
                    <span className="text-[var(--fg-muted)]"> reads · {numberWithCommas(p.clapCount)} claps</span>
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--surface)] overflow-hidden" aria-hidden>
                  <motion.div
                    className="h-full rounded-full hue-dot origin-left"
                    style={{ width: `${(p.viewCount / max) * 100}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: dur.slow, ease: ease.out, delay: i * 0.05 }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[var(--fg-muted)]">Published {formatDate(p.publishedAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </Reveal>
    </>
  )
}
