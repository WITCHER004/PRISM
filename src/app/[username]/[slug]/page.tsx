import { MOCK_POSTS, MOCK_COMMENTS } from "@/lib/data"
import { getPostBySlug } from "@/actions/posts"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Avatar } from "@/components/ui/Avatar"
import { CommentSection } from "@/components/posts/CommentSection"
import { PaywallGate } from "@/components/posts/PaywallGate"
import { PaywalledBody, UnlockedOnly, LockedOnly } from "@/components/posts/PaywallContent"
import { FollowButton } from "@/components/ui/FollowButton"
import { ReadingProgress } from "@/components/posts/ReadingProgress"
import { PostCard } from "@/components/posts/PostCard"
import { ArticleDock } from "@/components/posts/ArticleDock"
import { ListenMode } from "@/components/posts/ListenMode"
import { TableOfContents, type TocItem } from "@/components/posts/TableOfContents"
import { Reveal } from "@/components/motion/Reveal"
import { RevealText } from "@/components/motion/RevealText"
import { ParallaxImage } from "@/components/motion/ParallaxImage"
import { CodeSandboxBlock } from "@/components/interactive/CodeSandboxBlock"
import { ChartBlock } from "@/components/interactive/ChartBlock"
import { PollBlock } from "@/components/interactive/PollBlock"
import { ReadTimeTracker } from "@/components/posts/ReadTimeTracker"
import Link from "next/link"
import { formatDate, generateSlug, numberWithCommas } from "@/lib/utils"
import { BadgeCheck, Lock, ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

interface PostPageProps {
  params: Promise<{ username: string; slug: string }>
}

function withHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = []
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (match, attrs = "", inner: string) => {
    if (/\sid=/.test(attrs)) return match
    const text = inner.replace(/<[^>]+>/g, "").trim()
    let id = generateSlug(text) || `section-${toc.length + 1}`
    if (toc.some((t) => t.id === id)) id = `${id}-${toc.length + 1}`
    toc.push({ id, text })
    return `<h2${attrs} id="${id}">${inner}</h2>`
  })
  return { html: out, toc }
}

function toSpeechChunks(title: string, html: string): string[] {
  const decode = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&mdash;/g, "—")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  const blocks = [...html.matchAll(/<(p|h[1-4]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const chunks: string[] = [title]
  for (const block of blocks) {
    if (block.length <= 240) {
      chunks.push(block)
      continue
    }
    let cur = ""
    for (const sentence of block.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [block]) {
      if (cur && (cur + sentence).length > 240) {
        chunks.push(cur.trim())
        cur = ""
      }
      cur += sentence
    }
    if (cur.trim()) chunks.push(cur.trim())
  }
  return chunks
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { username, slug } = await params
  const post = await getPostBySlug(username, slug)
  if (!post) return { title: "Not Found" }
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : [],
      type: "article",
      authors: [post.author.displayName],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { username, slug } = await params
  const post = await getPostBySlug(username, slug)

  if (!post) {
    notFound()
  }

  const { html, toc } = withHeadingIds(post.contentHtml)
  const isPaywalled = post.paywallTier !== "FREE"
  const previewFraction = post.paywallTier === "METERED" ? 0.35 : 0.2
  const topic = post.tags[0]

  const relatedPosts = MOCK_POSTS.filter(
    (p) => p.id !== post.id && p.tags.some((t) => post.tags.some((pt) => pt.slug === t.slug))
  ).slice(0, 3)

  const showDemoBlocks = post.slug === "building-software-that-lasts-20-years"

  const dockProps = {
    postId: post.id,
    postSlug: post.slug,
    clapCount: post.clapCount,
    commentCount: MOCK_COMMENTS.length,
    postTitle: post.title,
    author: { id: post.author.id, displayName: post.author.displayName, username: post.author.username },
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)] font-serif">
      <ReadingProgress />
      <ReadTimeTracker postId={post.id} />

      <SiteHeader />

      <main className="relative flex-1">
        <article>
          {/* Header */}
          <header className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
            <Reveal>
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Dispatch
                </Link>
                <span className="text-[var(--border)]">|</span>
                {topic && (
                  <Link
                    href={`/explore/${topic.slug}`}
                    className="font-mono text-xs uppercase tracking-widest font-bold text-[var(--accent)] hover:underline"
                  >
                    ★ {topic.name}
                  </Link>
                )}
                {isPaywalled && (
                  <>
                    <span className="text-[var(--border)]">|</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] px-2 py-0.5 border border-[var(--border)] bg-[var(--surface)]">
                      <Lock className="w-3 h-3 text-[var(--accent)]" />
                      {post.paywallTier === "METERED" ? "Member preview" : "Members only"}
                    </span>
                  </>
                )}
              </div>

              <RevealText
                className="font-serif font-black mt-6 text-3xl sm:text-5xl lg:text-6xl leading-[1.08] tracking-tight text-[var(--fg)]"
                lines={[{ text: post.title }]}
              />

              {post.subtitle && (
                <p className="mt-4 max-w-3xl font-serif italic text-xl sm:text-2xl leading-relaxed text-[var(--fg-secondary)]">
                  {post.subtitle}
                </p>
              )}

              {/* Broadsheet Byline & Dateline */}
              <div className="mt-8 pt-3 pb-3 border-t border-b border-[var(--border-strong)] flex flex-wrap items-center justify-between gap-y-3 font-mono text-xs uppercase text-[var(--fg-muted)]">
                <div className="flex items-center gap-3">
                  <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="sm" className="border border-[var(--border-strong)]" />
                  <div>
                    <Link href={`/${post.author.username}`} className="font-bold text-[var(--fg)] hover:text-[var(--accent)] flex items-center gap-1">
                      BY {post.author.displayName.toUpperCase()}
                      {post.author.isVerifiedHuman && (
                        <BadgeCheck className="w-3.5 h-3.5 text-[var(--accent)]" aria-label="Verified writer" />
                      )}
                    </Link>
                    <p className="text-[10px] text-[var(--fg-subtle)] mt-0.5">{numberWithCommas(post.author.followerCount)} SUBSCRIBERS</p>
                  </div>
                  <FollowButton
                    username={post.author.username}
                    displayName={post.author.displayName}
                    size="sm"
                    className="ml-2 h-7 rounded-none font-mono text-[11px] uppercase tracking-wider"
                  />
                </div>

                <div className="flex items-center gap-4 text-[11px]">
                  <span>DATE: <time dateTime={post.publishedAt}>{formatDate(post.publishedAt).toUpperCase()}</time></span>
                  <span>·</span>
                  <span>READ TIME: {post.readingTimeMin} MIN</span>
                  <UnlockedOnly postId={post.id} paywalled={isPaywalled}>
                    <span>·</span>
                    <ListenMode
                      title={post.title}
                      chunks={toSpeechChunks(post.title, post.contentHtml)}
                      minutes={post.readingTimeMin}
                    />
                  </UnlockedOnly>
                </div>
              </div>
            </Reveal>
          </header>

          {post.coverImageUrl && (
            <Reveal index={1} className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
              <div className="border border-[var(--border-strong)] p-1 bg-[var(--panel)]">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface)]">
                  <ParallaxImage
                    src={post.coverImageUrl}
                    alt={post.title}
                    priority
                    className="w-full h-full object-cover broadsheet-photo"
                  />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-[var(--fg-subtle)] px-1">
                <span className="italic font-serif">Plate 1: Primary architectural inspection &amp; technical schematic.</span>
                <span className="uppercase tracking-widest">PRISM PHOTO ARCHIVE</span>
              </div>
            </Reveal>
          )}

          {/* Body with side rails */}
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-12 grid xl:grid-cols-[1fr_minmax(0,720px)_1fr] gap-x-12">
            <aside className="hidden xl:block">
              <div className="sticky top-28 ml-auto w-56 font-mono text-xs">
                <TableOfContents items={toc} />
              </div>
            </aside>

            <div className="min-w-0">
              <div id="article-body" className="relative prose-broadsheet text-lg leading-relaxed">
                <PaywalledBody postId={post.id} paywalled={isPaywalled} html={html} previewFraction={previewFraction} />

                {/* Interactive storytelling blocks (demo story) */}
                {showDemoBlocks && !isPaywalled && (
                  <div className="mt-12 space-y-8">
                    <CodeSandboxBlock
                      title="Interactive Saga Compensating Transaction Simulation"
                      description="Edit and click 'Run Simulation' to observe how distributed compensation restores state on failure."
                    />
                    <ChartBlock
                      title="System Benchmark: 2PC vs. Saga Orchestrator"
                      subtitle="Tested at Stripe under 10k concurrent payment transactions."
                    />
                    <PollBlock question="Which distributed transaction architecture does your team currently run in production?" />
                  </div>
                )}

                {isPaywalled && (
                  <LockedOnly postId={post.id} paywalled={isPaywalled}>
                    <PaywallGate post={post} />
                  </LockedOnly>
                )}
              </div>

              <UnlockedOnly postId={post.id} paywalled={isPaywalled} delay={0.25}>
                <>
                  {post.tags.length > 0 && (
                    <div className="mt-12 flex flex-wrap gap-2 font-mono text-xs uppercase">
                      {post.tags.map((tag) => (
                        <Link
                          key={tag.id}
                          href={`/explore/${tag.slug}`}
                          className="px-3 py-1 border border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] transition-colors"
                        >
                          # {tag.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Author card with Broadsheet Hairline Rules */}
                  <section className="mt-10 p-6 sm:p-8 border border-[var(--border-strong)] bg-[var(--surface)]">
                    <div className="flex flex-col sm:flex-row gap-5">
                      <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="xl" className="border border-[var(--border-strong)]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-bold">STAFF CORRESPONDENT</p>
                        <Link href={`/${post.author.username}`} className="font-serif font-black text-2xl sm:text-3xl mt-1 inline-flex items-center gap-2 hover:text-[var(--accent)]">
                          {post.author.displayName}
                          {post.author.isVerifiedHuman && (
                            <BadgeCheck className="w-5 h-5 text-[var(--accent)]" aria-label="Verified writer" />
                          )}
                        </Link>
                        <p className="mt-2.5 font-serif text-sm leading-relaxed text-[var(--fg-secondary)]">{post.author.bio}</p>
                        <p className="font-mono text-xs text-[var(--fg-muted)] mt-3 uppercase">{numberWithCommas(post.author.followerCount)} DIRECT READERS</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <FollowButton
                            username={post.author.username}
                            displayName={post.author.displayName}
                            className="px-5 rounded-none font-mono text-xs uppercase"
                          />
                          <Link
                            href={`/${post.author.username}`}
                            className="h-9 px-4 inline-flex items-center rounded-none font-mono text-xs uppercase font-medium bg-[var(--panel)] border border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors"
                          >
                            Dispatches by {post.author.displayName.split(" ")[0]} &rarr;
                          </Link>
                        </div>
                      </div>
                    </div>
                  </section>

                  <CommentSection postId={post.id} comments={MOCK_COMMENTS} postTitle={post.title} />
                </>
              </UnlockedOnly>
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-28">
                <UnlockedOnly postId={post.id} paywalled={isPaywalled} delay={0.35}>
                  <ArticleDock {...dockProps} layout="rail" />
                </UnlockedOnly>
              </div>
            </aside>
          </div>
        </article>

        <UnlockedOnly postId={post.id} paywalled={isPaywalled} rise={false} delay={0.35}>
          <div className="xl:hidden">
            <ArticleDock {...dockProps} layout="bar" />
          </div>
        </UnlockedOnly>

        {/* Related Dispatches */}
        {relatedPosts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 border-t border-[var(--border-strong)] mt-16">
            <div className="flex items-center justify-between pb-3 mb-6 border-b-2 border-[var(--border-strong)]">
              <h2 className="font-serif font-black text-2xl uppercase tracking-tight text-[var(--fg)]">
                Further Reading From This Desk
              </h2>
              <span className="font-mono text-xs uppercase text-[var(--fg-muted)]">SECTION ARCHIVE</span>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((p, i) => (
                <Reveal key={p.id} index={i}>
                  <PostCard post={p} variant="tile" className="h-full" />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
