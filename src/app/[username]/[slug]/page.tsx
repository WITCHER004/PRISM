import { MOCK_POSTS, MOCK_COMMENTS, MOCK_PEER_REVIEWS } from "@/lib/data"
import { deepReadMinutes, PAPER_MASK, PAPER_PREVIEW_FRACTION } from "@/lib/papers"
import { seededCertificate } from "@/lib/craft"
import { SEED_DOSSIERS } from "@/lib/dossier"
import { CraftBadge } from "@/components/craft/CraftBadge"
import { PeerDossierCard } from "@/components/dossier/PeerDossierCard"
import { ElitePaperBadge, MaybePaperScope, PaperAbstract, PaperGate, PaperRibbon } from "@/components/papers/ElitePaper"
import { getPostBySlug } from "@/actions/posts"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
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
import { hueStyle } from "@/lib/topics"
import Link from "next/link"
import { formatDate, generateSlug, numberWithCommas } from "@/lib/utils"
import { BadgeCheck, Lock, ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import { JsonLd } from "@/components/seo/JsonLd"
import { UserAvatar } from "@/components/profile/identity"
import { UserBadges } from "@/components/elite/EliteBadges"
import { ViewTracker } from "@/components/elite/ViewTracker"
import { AuthorShareBar } from "@/components/share/ShareArticle"
import { RatingChip, ReviewsSection } from "@/components/reviews/ArticleReviews"
import { absoluteUrl, SITE_URL, socialImageUrl, truncateDescription } from "@/lib/seo"
import { ArticleInteractiveWrapper } from "@/components/reader/ArticleInteractiveWrapper"

interface PostPageProps {
  params: Promise<{ username: string; slug: string }>
}

// Give each <h2> an id so the contents rail can link to and track it
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

// Split story HTML into short, speakable pieces for listen mode: one per block,
// with long paragraphs broken at sentence ends so the voice never runs on too long
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
  if (!post || post.status !== "PUBLISHED") {
    return { title: "Not Found", robots: { index: false, follow: false } }
  }
  const description = truncateDescription(post.excerpt)
  const image = post.coverImageUrl ?? socialImageUrl(post.title, description)
  const canonical = `/${post.author.username}/${post.slug}`
  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      url: canonical,
      images: [{ url: image, alt: post.title }],
      type: "article",
      authors: [post.author.displayName],
      publishedTime: post.publishedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [{ url: image, alt: post.title }],
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { username, slug } = await params
  const post = await getPostBySlug(username, slug)
  if (!post || post.status !== "PUBLISHED") notFound()

  // Locked stories show a clipped preview; PaywalledBody releases it once the reader unlocks
  // (demo only: the full HTML is still sent — real gating must withhold it on the server)
  // Advanced Papers gate on Elite (see PaperScope) whatever their paywall tier says
  const paper = post.paper
  const isPaywalled = post.paywallTier !== "FREE" || !!paper
  // Papers preview a quarter; metered stories half; member-only and paid ones a third
  const previewFraction = paper ? PAPER_PREVIEW_FRACTION : post.paywallTier === "METERED" ? 0.5 : 0.33
  const paperReview =
    (MOCK_PEER_REVIEWS[post.id]?.length ?? 0) > 0 || paper?.depth === "monograph" ? "Peer-reviewed" : "Editor-reviewed"
  // The interactive demo blocks belong to the distributed-transactions story only
  const showDemoBlocks = post.slug === "hidden-cost-distributed-transactions"

  const relatedPosts = MOCK_POSTS.filter(
    (p) =>
      p.id !== post.id &&
      p.tags.some((t) => post.tags.some((pt) => pt.id === t.id))
  ).slice(0, 3)

  const topic = post.tags[0]
  const { html, toc } = withHeadingIds(post.contentHtml)
  const dockProps = {
    postId: post.id,
    clapCount: post.clapCount,
    commentCount: post.commentCount,
    author: { id: post.author.id, displayName: post.author.displayName, username: post.author.username },
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)]" style={hueStyle(topic?.slug)}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: truncateDescription(post.excerpt),
          datePublished: post.publishedAt,
          inLanguage: "en",
          isAccessibleForFree: !isPaywalled,
          mainEntityOfPage: absoluteUrl(`/${post.author.username}/${post.slug}`),
          image: post.coverImageUrl ?? socialImageUrl(post.title, truncateDescription(post.excerpt)),
          author: {
            "@type": "Person",
            name: post.author.displayName,
            url: absoluteUrl(`/${post.author.username}`),
          },
          publisher: {
            "@type": "Organization",
            name: "Prism",
            url: SITE_URL.toString(),
          },
        }}
      />
      <ReadingProgress />
      <ReadTimeTracker postId={post.id} />
      <ViewTracker postId={post.id} author={post.author.username} />

      {/* Topic-tinted glow behind the header */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] hue-glow" />

      <SiteHeader />

      <MaybePaperScope paper={paper} author={post.author.username}>
      <main className="relative flex-1">
        <article>
          {/* Header */}
          <header className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
            <Reveal>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 h-8 pl-2 pr-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Home
                </Link>
                {topic && (
                  <Link
                    href={`/explore/${topic.slug}`}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full hue-wash hue-ink text-sm font-medium"
                  >
                    <span className="w-2 h-2 rounded-full hue-dot" />
                    {topic.name}
                  </Link>
                )}
                {paper ? (
                  <ElitePaperBadge className="h-8 px-3 text-[0.8125rem]" />
                ) : isPaywalled && (
                  <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg-muted)]">
                    <Lock className="w-3.5 h-3.5" />
                    {post.paywallTier === "METERED" ? "Member preview" : "Members only"}
                  </span>
                )}
              </div>

              <RevealText
                className="display mt-6 text-[2.5rem] sm:text-[3.75rem] lg:text-[4.5rem] leading-[0.98]"
                lines={[{ text: post.title }]}
              />

              {post.subtitle && (
                <p className="mt-6 max-w-3xl text-xl sm:text-2xl leading-snug text-[var(--fg-muted)]">
                  {post.subtitle}
                </p>
              )}

              {/* Byline */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar username={post.author.username} fallbackSrc={post.author.avatarUrl} alt={post.author.displayName} size="md" />
                  <div>
                    <Link href={`/${post.author.username}`} className="flex items-center gap-1 font-semibold hover:underline">
                      {post.author.displayName}
                      {post.author.isVerifiedHuman && (
                        <BadgeCheck className="w-4 h-4 text-[var(--accent)]" aria-label="Verified writer" />
                      )}
                    </Link>
                    <UserBadges username={post.author.username} compact className="mt-1" />
                    <p className="meta mt-0.5">{numberWithCommas(post.author.followerCount)} readers</p>
                  </div>
                  <FollowButton
                    username={post.author.username}
                    displayName={post.author.displayName}
                    size="sm"
                    className="ml-2 h-9"
                  />
                </div>
                <dl className="flex items-center gap-5 meta">
                  <div>
                    <dt className="sr-only">Published</dt>
                    <dd><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></dd>
                  </div>
                  <div>
                    <dt className="sr-only">Reading time</dt>
                    <dd>{post.readingTimeMin} min read</dd>
                  </div>
                </dl>
                <RatingChip postId={post.id} href="#reviews" />
                <CraftBadge certificate={seededCertificate(post.id, post.wordCount)} authorName={post.author.displayName} />
                <UnlockedOnly postId={post.id} paywalled={isPaywalled}>
                  <ListenMode
                    title={post.title}
                    chunks={toSpeechChunks(post.title, post.contentHtml)}
                    minutes={post.readingTimeMin}
                  />
                </UnlockedOnly>
              </div>
            </Reveal>
          </header>

          {/* Elite / peer-reviewed: the panel's verdict, open to every reader */}
          {SEED_DOSSIERS[post.id] && (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
              <PeerDossierCard
                dossier={SEED_DOSSIERS[post.id]}
                authorName={post.author.displayName}
                authorAvatar={post.author.avatarUrl}
              />
            </div>
          )}

          {post.coverImageUrl && (
            <Reveal index={1} className="max-w-6xl mx-auto px-4 sm:px-6 mt-10">
              <ParallaxImage
                src={post.coverImageUrl}
                alt={post.title}
                priority
                className="aspect-[2/1] w-full rounded-[28px] bg-[var(--surface)] shadow-[var(--shadow-lift)]"
              />
            </Reveal>
          )}

          {/* Body with side rails */}
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-12 grid xl:grid-cols-[1fr_minmax(0,720px)_1fr] gap-x-12">
            <aside className="hidden xl:block">
              <div className="sticky top-28 ml-auto w-56">
                <TableOfContents items={toc} />
              </div>
            </aside>

            <div className="min-w-0">
              <ArticleInteractiveWrapper
                articleId={post.id}
                articleTitle={post.title}
                authorName={post.author.displayName}
                authorHandle={post.author.username}
              >
              <div id="article-body" className="relative">
                {paper && (
                  <>
                    <PaperAbstract paper={paper} className="mb-8" />
                    <PaperRibbon paper={paper} className="mb-10" />
                  </>
                )}
                <PaywalledBody
                  postId={post.id}
                  paywalled={isPaywalled}
                  html={html}
                  previewFraction={previewFraction}
                  mask={paper ? PAPER_MASK : undefined}
                />

                {/* Interactive storytelling blocks (demo story) */}
                {showDemoBlocks && (!isPaywalled || paper) && (
                  <UnlockedOnly postId={post.id} paywalled={isPaywalled}>
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
                  </UnlockedOnly>
                )}

                {isPaywalled && (
                  <LockedOnly postId={post.id} paywalled={isPaywalled}>
                    {paper ? (
                      <PaperGate wordCount={post.wordCount} deepReadMin={deepReadMinutes(post.wordCount)} review={paperReview} />
                    ) : (
                      <PaywallGate post={post} />
                    )}
                  </LockedOnly>
                )}
              </div>
              </ArticleInteractiveWrapper>

              <UnlockedOnly postId={post.id} paywalled={isPaywalled} delay={0.25}>
                <>
                  {post.tags.length > 0 && (
                    <div className="mt-12 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Link
                          key={tag.id}
                          href={`/explore/${tag.slug}`}
                          style={hueStyle(tag.slug)}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full hue-wash hue-ink text-sm font-medium hover:opacity-80 transition-opacity"
                        >
                          <span className="w-2 h-2 rounded-full hue-dot" />
                          {tag.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Author card */}
                  <section className="mt-10 panel p-6 sm:p-8 shadow-[var(--shadow)] relative overflow-hidden">
                    <div aria-hidden className="absolute inset-0 hue-glow opacity-60" />
                    <div className="relative flex flex-col sm:flex-row gap-5">
                      <UserAvatar username={post.author.username} fallbackSrc={post.author.avatarUrl} alt={post.author.displayName} size="xl" />
                      <div className="flex-1 min-w-0">
                        <p className="meta">Written by</p>
                        <Link href={`/${post.author.username}`} className="display mt-1.5 text-3xl inline-flex items-center gap-2 hover:underline">
                          {post.author.displayName}
                          {post.author.isVerifiedHuman && (
                            <BadgeCheck className="w-5 h-5 text-[var(--accent)]" aria-label="Verified writer" />
                          )}
                        </Link>
                        <p className="mt-3 leading-relaxed text-[var(--fg-secondary)]">{post.author.bio}</p>
                        <p className="meta mt-3">{numberWithCommas(post.author.followerCount)} readers</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <FollowButton
                            username={post.author.username}
                            displayName={post.author.displayName}
                            className="px-5"
                          />
                          <Link
                            href={`/${post.author.username}`}
                            className="h-10 px-5 inline-flex items-center rounded-full text-sm font-medium bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors"
                          >
                            More by {post.author.displayName.split(" ")[0]}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </section>

                  <AuthorShareBar
                    title={post.title}
                    url={`/${post.author.username}/${post.slug}`}
                    authorUsername={post.author.username}
                    className="mt-10"
                  />

                  <ReviewsSection postId={post.id} postAuthor={post.author.username} className="mt-16" />

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

        {/* Related */}
        {relatedPosts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24">
            <h2 className="display text-[1.75rem] sm:text-[2.25rem] mb-5">Keep reading</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedPosts.map((p, i) => (
                <Reveal key={p.id} index={i}>
                  <PostCard post={p} variant="tile" className="h-full" />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>
      </MaybePaperScope>

      <SiteFooter />
    </div>
  )
}
