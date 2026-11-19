"use client"

import Link from "next/link"
import { BadgeCheck, Gem, Lock } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import type { User } from "@/lib/data"
import { TOPICS } from "@/lib/topics"
import type { PaywallChoice } from "@/lib/store"
import { formatDate, numberWithCommas } from "@/lib/utils"
import { hasBody, wordCount } from "@/components/studio/studio-ui"
import { UserBadges } from "@/components/elite/EliteBadges"
import { ElitePaperBadge, MaybePaperScope, PaperAbstract, PaperGate, PaperRibbon } from "@/components/papers/ElitePaper"
import { LockedOnly, PaywalledBody } from "@/components/posts/PaywallContent"
import { deepReadMinutes, PAPER_MASK, PAPER_PREVIEW_FRACTION, type AdvancedPaper } from "@/lib/papers"
import { ArticleInteractiveWrapper } from "@/components/reader/ArticleInteractiveWrapper"
import { ExportMenu } from "@/components/reader/ExportMenu"

export function topicLabel(tag: string) {
  const known = TOPICS.find((t) => t.slug === tag)
  return known ? known.name : tag.replace(/-/g, " ")
}

const PAYWALL_LABEL: Record<PaywallChoice, string | null> = {
  FREE: null,
  METERED: "Member preview",
  SUBSCRIBER: "Members only",
  PAID: "Paid story",
}

interface StoryArticleProps {
  title: string
  subtitle?: string
  html: string
  tags: string[]
  paywall: PaywallChoice
  date: string
  author: User
  authorName: string
  /** Extra line under the byline (e.g. rating summary) */
  meta?: React.ReactNode
  /** Advanced Paper settings; gates the body to Elite readers */
  paper?: AdvancedPaper
  /** Needed to gate a paper's body */
  postId?: string
  /** Verification shown on the paper gate */
  paperReview?: string
  /** Rendered between the header and the body (e.g. the peer review dossier) */
  afterHeader?: React.ReactNode
  /**
   * Published stories only: turns on private highlights, resume/progress sync, reading history and
   * export. `href` is the path readers reopen it at.
   */
  reader?: { href: string; aiScore?: number | null }
}

// The reader's view of a story written in Prism — same structure and type as the article page.
export function StoryArticle({ title, subtitle, html, tags, paywall, date, author, authorName, meta, paper, postId, paperReview = "Editor-reviewed", afterHeader, reader }: StoryArticleProps) {
  const topic = tags[0]
  const known = topic ? TOPICS.find((t) => t.slug === topic) : undefined
  const minutes = Math.max(1, Math.ceil(wordCount(html) / 238))
  const gate = PAYWALL_LABEL[paywall]
  const words = wordCount(html)

  const effectiveArticleId = postId ?? `article_${author.username}_${title.slice(0, 15)}`
  const topicName = topic ? topicLabel(topic) : ""

  return (
    <MaybePaperScope paper={paper} author={author.username}>
    <ArticleInteractiveWrapper
      articleId={effectiveArticleId}
      articleTitle={title.trim() || "Untitled story"}
      authorName={authorName}
      authorHandle={author.username}
      reading={
        reader && postId
          ? {
              articleSubtitle: subtitle ?? "",
              topic: topicName,
              authorAvatar: author.avatarUrl,
              isAdvancedPaper: !!paper,
              href: reader.href,
            }
          : undefined
      }
    >
    <article className="relative">
      <header>
        {(topic || gate || paper) && (
          <div className="flex flex-wrap items-center gap-2">
            {topic &&
              (known ? (
                <Link
                  href={`/explore/${known.slug}`}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full hue-wash hue-ink text-sm font-medium"
                >
                  <span className="w-2 h-2 rounded-full hue-dot" />
                  {known.name}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full hue-wash hue-ink text-sm font-medium capitalize">
                  <span className="w-2 h-2 rounded-full hue-dot" />
                  {topicLabel(topic)}
                </span>
              ))}
            {paper ? (
              <ElitePaperBadge className="h-8 px-3 text-[0.8125rem]" />
            ) : gate && (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg-muted)]">
                {paywall === "PAID" ? <Gem className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {gate}
              </span>
            )}
          </div>
        )}

        <h1 className="display mt-6 text-[2.5rem] sm:text-[3.75rem] leading-[0.98] break-words">
          {title.trim() || "Untitled story"}
        </h1>
        {subtitle?.trim() && (
          <p className="mt-6 max-w-3xl text-xl sm:text-2xl leading-snug text-[var(--fg-muted)]">{subtitle}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center gap-3">
            <Avatar src={author.avatarUrl} alt={authorName} size="md" />
            <div>
              <Link href={`/${author.username}`} className="flex items-center gap-1 font-semibold hover:underline">
                {authorName}
                {author.isVerifiedHuman && (
                  <BadgeCheck className="w-4 h-4 text-[var(--accent)]" aria-label="Verified writer" />
                )}
              </Link>
              <UserBadges username={author.username} compact className="mt-1" />
              <p className="meta mt-0.5">{numberWithCommas(author.followerCount)} readers</p>
            </div>
          </div>
          <dl className="flex items-center gap-5 meta">
            <div>
              <dt className="sr-only">Date</dt>
              <dd>
                <time dateTime={date}>{formatDate(date)}</time>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Reading time</dt>
              <dd>{minutes} min read</dd>
            </div>
          </dl>
          {meta}
          {reader && postId && (
            <ExportMenu
              postId={postId}
              html={html}
              isAdvancedPaper={!!paper}
              paywalled={paywall !== "FREE"}
              meta={{
                title: title.trim() || "Untitled story",
                subtitle,
                authorName,
                authorHandle: author.username,
                topic: topicName,
                publishedAt: date,
                aiVerificationScore: reader.aiScore,
                path: reader.href,
              }}
            />
          )}
        </div>
      </header>

      {afterHeader && <div className="mt-8">{afterHeader}</div>}

      <div className="mt-12">
        {paper && (
          <>
            <PaperAbstract paper={paper} className="mb-8" />
            <PaperRibbon paper={paper} className="mb-10" />
          </>
        )}
        {paper && postId && hasBody(html) ? (
          <>
            <PaywalledBody postId={postId} paywalled html={html} previewFraction={PAPER_PREVIEW_FRACTION} mask={PAPER_MASK} />
            <LockedOnly postId={postId} paywalled>
              <PaperGate wordCount={words} deepReadMin={deepReadMinutes(words)} review={paperReview} />
            </LockedOnly>
          </>
        ) : hasBody(html) ? (
          <div className="prose-prism" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="prose-prism italic text-[var(--fg-subtle)]">Nothing here yet — the body is empty.</p>
        )}
      </div>
    </article>
    </ArticleInteractiveWrapper>
    </MaybePaperScope>
  )
}
