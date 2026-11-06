import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { PostCard } from "@/components/posts/PostCard"
import { SpectrumBar } from "@/components/home/SpectrumBar"
import { Reveal } from "@/components/motion/Reveal"
import { RevealText } from "@/components/motion/RevealText"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { MOCK_TAGS, MOCK_USERS } from "@/lib/data"
import { getFeedPosts } from "@/actions/posts"
import { hueStyle } from "@/lib/topics"
import { numberWithCommas } from "@/lib/utils"
import Link from "next/link"
import { ArrowRight, BadgeCheck, Timer } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Prism — Ideas, refracted",
  description:
    "Discover the world's best independent writers. No paywalls that punish curiosity. No algorithmic noise. Just ideas.",
}

export default async function HomePage() {
  const posts = await getFeedPosts(10)
  const [lead, second, ...rest] = posts
  const quickReads = [...posts.slice(1)].sort((a, b) => a.readingTimeMin - b.readingTimeMin).slice(0, 4)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />

      <main className="flex-1">
        {/* Intro + today's spectrum */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 grid lg:grid-cols-12 gap-10 items-end">
          <Reveal className="lg:col-span-7">
            <p className="meta">Independent writing · Read by humans</p>
            <RevealText
              className="display mt-4 text-[3.25rem] sm:text-[4.75rem] lg:text-[5.75rem] leading-[0.92]"
              lines={[{ text: "Ideas," }, { text: "refracted.", className: "spectrum-text spectrum-sweep" }]}
              delay={0.1}
            />
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--fg-muted)]">
              One beam of curiosity, split into every topic worth your time. No feeds built to trap you, just writers
              who own their audience.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors"
              >
                Start reading <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/auth/signup?writer=true"
                className="inline-flex items-center h-12 px-6 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] font-medium hover:border-[var(--fg)] transition-colors"
              >
                Publish on Prism
              </Link>
            </div>
          </Reveal>

          <Reveal index={2} className="lg:col-span-5">
            <div className="panel p-6 shadow-[var(--shadow)]">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display font-semibold text-lg tracking-tight">Today&apos;s spectrum</h2>
                <span className="meta">What people are reading</span>
              </div>
              <div className="mt-5">
                <SpectrumBar tags={MOCK_TAGS} />
              </div>
            </div>
          </Reveal>
        </section>

        {/* Topic rail */}
        <nav aria-label="Topics" className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {MOCK_TAGS.map((tag) => (
              <Link
                key={tag.id}
                href={`/explore/${tag.slug}`}
                style={hueStyle(tag.slug)}
                className="group shrink-0 inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg-secondary)] hover:hue-wash hover:hue-ink hover:border-transparent transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full hue-dot" />
                {tag.name}
              </Link>
            ))}
          </div>
        </nav>

        {/* Bento */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(260px,auto)]">
            <Reveal className="md:col-span-2 lg:row-span-2">
              <PostCard post={lead} variant="hero" />
            </Reveal>

            {second && (
              <Reveal index={1} className="lg:row-span-2">
                <PostCard post={second} variant="tile" />
              </Reveal>
            )}

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
          </div>
        </section>

        {/* Fresh */}
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

        {/* Writers */}
        <section className="pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <SectionTitle title="Writers worth following" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {MOCK_USERS.map((user, i) => (
                <Reveal key={user.id} index={i} className="snap-start shrink-0 w-[280px]">
                  <WriterCard user={user} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Join band */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] bg-[var(--fg)] text-[var(--bg)] p-8 sm:p-12">
              <div className="absolute inset-x-0 top-0 h-1.5 spectrum-bg" />
              <div className="grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider opacity-60">For writers</p>
                  <h2 className="display mt-3 text-4xl sm:text-5xl">
                    Your readers.
                    <br />
                    Your domain. Your rules.
                  </h2>
                </div>
                <div>
                  <p className="opacity-70 leading-relaxed">
                    Custom domains, portable subscriber lists, and payouts based on real read time, not clicks.
                  </p>
                  <Link
                    href="/auth/signup?writer=true"
                    className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--bg)] text-[var(--fg)] font-medium hover:opacity-90 transition-opacity"
                  >
                    Start your publication <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
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

function WriterCard({ user }: { user: (typeof MOCK_USERS)[0] }) {
  return (
    <div className="panel h-full p-5 shadow-[var(--shadow)] flex flex-col">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl} alt={user.displayName} size="lg" />
        <div className="min-w-0">
          <Link href={`/${user.username}`} className="flex items-center gap-1 font-semibold hover:underline">
            <span className="truncate">{user.displayName}</span>
            {user.isVerifiedHuman && <BadgeCheck className="w-4 h-4 shrink-0 text-[var(--accent)]" aria-label="Verified writer" />}
          </Link>
          <p className="meta mt-0.5">{numberWithCommas(user.followerCount)} readers</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-3">{user.bio}</p>
      <div className="mt-auto pt-5 flex gap-2">
        <FollowButton username={user.username} displayName={user.displayName} className="flex-1" />
        <Link
          href={`/${user.username}`}
          className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-full border border-[var(--border)] text-sm hover:border-[var(--border-strong)] transition-colors"
        >
          Profile
        </Link>
      </div>
    </div>
  )
}
