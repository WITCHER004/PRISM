"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, Timer, X } from "lucide-react"
import { PostCard } from "@/components/posts/PostCard"
import { Reveal } from "@/components/motion/Reveal"
import { SpectrumCard } from "@/components/home/SpectrumCard"
import { hueStyle } from "@/lib/topics"
import { MOCK_TAGS, type Post, type Tag } from "@/lib/data"

const UNFILTERED = 10

/** The `?topic=` the spectrum card sets, read in the browser so the page itself stays static. */
function useTopic(): Tag | undefined {
  const slug = useSearchParams().get("topic")
  return MOCK_TAGS.find((t) => t.slug === slug)
}

export function SpectrumCardWithTopic({ tags }: { tags: Tag[] }) {
  return <SpectrumCard tags={tags} activeTopic={useTopic()?.slug} />
}

export function HomeFeedWithTopic({ posts }: { posts: Post[] }) {
  return <HomeFeed posts={posts} topic={useTopic()} />
}

/** Bento + "Fresh from writers". Unfiltered it shows the latest stories; with a topic, all of that topic's. */
export function HomeFeed({ posts: all, topic }: { posts: Post[]; topic?: Tag }) {
  const posts = topic ? all.filter((p) => p.tags.some((t) => t.slug === topic.slug)) : all.slice(0, UNFILTERED)
  const [lead, second, ...rest] = posts
  const quickReads = [...posts.slice(1)].sort((a, b) => a.readingTimeMin - b.readingTimeMin).slice(0, 4)

  return (
    <>
      <section id="feed" className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16 scroll-mt-20">
        {topic && (
          <div className="mb-4 flex items-center gap-2 text-sm" style={hueStyle(topic.slug)}>
            <span className="text-[var(--fg-muted)]">Showing</span>
            <Link
              href="/"
              scroll={false}
              aria-label={`Clear ${topic.name} filter`}
              className="group inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full hue-wash hue-ink font-medium"
            >
              <span className="w-2 h-2 rounded-full hue-dot" />
              {topic.name}
              <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </Link>
            <span className="text-[var(--fg-muted)]">
              · {posts.length} {posts.length === 1 ? "story" : "stories"}
            </span>
          </div>
        )}

        {!lead ? (
          <div className="panel p-10 text-center text-[var(--fg-muted)]">
            No {topic?.name} stories in the feed yet.{" "}
            <Link href={`/explore/${topic?.slug}`} className="underline underline-offset-4 text-[var(--fg)]">
              Browse the topic
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(260px,auto)]">
            <Reveal className="md:col-span-2 lg:row-span-2">
              <PostCard post={lead} variant="hero" />
            </Reveal>

            {second && (
              <Reveal index={1} className="lg:row-span-2">
                <PostCard post={second} variant="tile" />
              </Reveal>
            )}

            {quickReads.length > 0 && (
              <Reveal index={2} className="lg:row-span-2">
                <div className="panel h-full p-5 shadow-[var(--shadow)]">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold text-lg tracking-tight">Quick reads</h2>
                    <Timer className="w-4 h-4 text-[var(--fg-muted)]" />
                  </div>
                  <p className="meta mt-1">Under a coffee break</p>
                  <div className="mt-2 divide-y divide-[var(--border)]">
                    {quickReads.map((post, i) => (
                      <PostCard key={post.id} post={post} variant="compact" index={i + 1} />
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <SectionTitle title="Fresh from writers" href="/explore" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {rest.map((post, i) => (
              <Reveal key={post.id} index={i}>
                <PostCard post={post} variant="tile" className="h-full" />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h2 className="display text-[1.75rem] sm:text-[2.25rem]">{title}</h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 h-9 px-4 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm hover:border-[var(--border-strong)] transition-colors"
        >
          See all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  )
}
