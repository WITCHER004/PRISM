import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Suspense } from "react"
import { SpectrumCard } from "@/components/home/SpectrumCard"
import { HomeFeed, HomeFeedWithTopic, SectionTitle, SpectrumCardWithTopic } from "@/components/home/HomeFeed"
import { Reveal } from "@/components/motion/Reveal"
import { RevealText } from "@/components/motion/RevealText"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import type { User } from "@/lib/data"
import { getActiveWriters, getPublishedPosts, getTopicCounts } from "@/lib/server/content"
import { hueStyle, TOPICS } from "@/lib/topics"
import { numberWithCommas } from "@/lib/utils"
import Link from "next/link"
import { ArrowRight, BadgeCheck } from "lucide-react"
import type { Metadata } from "next"
import { JsonLd } from "@/components/seo/JsonLd"
import { SITE_URL } from "@/lib/seo"
import { ScrollRail } from "@/components/ui/ScrollRail"
import { InstantIdeasTray } from "@/components/ideas/InstantIdeasTray"
import { EliteSpark } from "@/components/papers/ElitePaper"
import { ContinueReading } from "@/components/home/ContinueReading"

export const metadata: Metadata = {
  title: { absolute: "Prism — Ideas, refracted" },
  description:
    "Discover the world's best independent writers. No paywalls that punish curiosity. No algorithmic noise. Just ideas.",
  alternates: { canonical: "/" },
}

// Rendered on every request from live Firestore data. The `?topic=` filter runs in the browser
// (HomeFeed), so crawlers always get the full, unfiltered feed.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [feed, writers, counts] = await Promise.all([getPublishedPosts(), getActiveWriters(12), getTopicCounts()])
  const tags = TOPICS.map((t) => ({ ...t, postCount: counts.get(t.slug) ?? 0 }))

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}#organization`,
              name: "Prism",
              url: SITE_URL.toString(),
              description: "A publishing platform for independent writers and curious readers.",
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}#website`,
              name: "Prism",
              url: SITE_URL.toString(),
              description: "Discover independent writing across every topic.",
              publisher: { "@id": `${SITE_URL}#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }}
      />
      <SiteHeader />

      <main className="flex-1">
        {/* Intro + today's spectrum */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
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
                href="/editor/new"
                className="inline-flex items-center h-12 px-6 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] font-medium hover:border-[var(--fg)] transition-colors"
              >
                Publish on Prism
              </Link>
            </div>
          </Reveal>

          <Reveal index={2} className="lg:col-span-5">
            <Suspense fallback={<SpectrumCard tags={tags} />}>
              <SpectrumCardWithTopic tags={tags} />
            </Suspense>
          </Reveal>
        </section>

        {/* Topic rail */}
        <nav aria-label="Topics" className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollRail label="topics" className="flex gap-2 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Link
              href="/explore?filter=papers"
              className="shrink-0 inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full border border-[var(--elite-line)] bg-[var(--elite-wash)] text-sm font-medium text-[var(--elite-ink)] hover:border-[var(--elite-ink)] transition-colors"
            >
              <EliteSpark className="w-3 h-3" />
              Advanced Papers
            </Link>
            {tags.map((tag) => (
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
          </ScrollRail>
        </nav>

        {/* The signed-in reader's unfinished stories (Firestore reading_progress) */}
        <ContinueReading className="pt-8" />

        {/* Short-lived ideas, above the feed */}
        <InstantIdeasTray className="pt-8" />

        <Suspense fallback={<HomeFeed posts={feed} />}>
          <HomeFeedWithTopic posts={feed} />
        </Suspense>

        {/* Writers */}
        {writers.length > 0 && (
        <section className="pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <SectionTitle title="Writers worth following" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <ScrollRail label="writers" className="flex gap-4 snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {writers.map((user, i) => (
                <Reveal key={user.id} index={i} className="snap-start shrink-0 w-[280px]">
                  <WriterCard user={user} />
                </Reveal>
              ))}
            </ScrollRail>
          </div>
        </section>
        )}

        {/* Join band */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] bg-[var(--fg)] text-[var(--bg)] p-8 sm:p-12">
              <div className="absolute inset-x-0 top-0 h-1.5 spectrum-bg" />
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 items-end">
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
                    href="/editor/new"
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

function WriterCard({ user }: { user: User }) {
  return (
    <div className="panel h-full p-5 shadow-[var(--shadow)] flex flex-col">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl} alt={user.displayName} size="lg" />
        <div className="min-w-0">
          <Link href={`/${user.username}`} className="flex items-center gap-1 font-semibold hover:underline">
            <span className="truncate">{user.displayName}</span>
            {user.isVerifiedHuman && <BadgeCheck className="w-4 h-4 shrink-0 text-[var(--accent)]" aria-label="Verified writer" />}
          </Link>
          <p className="meta mt-0.5">
            {numberWithCommas(user.postCount)} {user.postCount === 1 ? "story" : "stories"}
          </p>
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
