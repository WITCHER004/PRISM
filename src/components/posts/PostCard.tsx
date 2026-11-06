"use client"

import Link from "next/link"
import Image from "next/image"
import { type Post } from "@/lib/data"
import { useUIStore, toast } from "@/lib/store"
import { formatRelativeDate, numberWithCommas, cn } from "@/lib/utils"
import { Bookmark, BookmarkCheck, Lock, HandHeart } from "lucide-react"

interface PostCardProps {
  post: Post
  variant?: "default" | "tile" | "compact" | "hero" | "featured"
  showAuthor?: boolean
  index?: number
  className?: string
}

export function PostCard({
  post,
  variant = "default",
  showAuthor = true,
  index,
  className,
}: PostCardProps) {
  const href = `/${post.author.username}/${post.slug}`
  const topic = post.tags[0]

  // ── 1. COMPACT / OPINION DISPATCH RAIL ITEM ─────────────────────────────
  if (variant === "compact") {
    return (
      <article className={cn("py-3.5 border-b border-[var(--border)] last:border-b-0", className)}>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[var(--fg-muted)] mb-1">
          {index !== undefined && (
            <span className="font-bold text-[var(--accent)]">#{String(index).padStart(2, "0")}</span>
          )}
          <span>{topic?.name ?? "DISPATCH"}</span>
          <span className="text-[var(--border)]">/</span>
          <span>{post.readingTimeMin} MIN</span>
          {post.paywallTier !== "FREE" && (
            <>
              <span className="text-[var(--border)]">/</span>
              <span className="text-[var(--accent)] font-semibold flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                {post.paywallTier}
              </span>
            </>
          )}
        </div>

        <Link href={href} className="group block">
          <h4 className="font-serif font-bold text-base sm:text-lg leading-snug text-[var(--fg)] group-hover:text-[var(--accent)] group-hover:underline underline-offset-2 transition-colors">
            {post.title}
          </h4>
        </Link>

        {post.subtitle && (
          <p className="mt-1 font-serif text-xs leading-relaxed text-[var(--fg-muted)] line-clamp-2">
            {post.subtitle}
          </p>
        )}

        {showAuthor && (
          <div className="mt-2 flex items-center justify-between text-xs font-mono text-[var(--fg-subtle)]">
            <span className="uppercase tracking-wide text-[var(--fg-secondary)]">
              BY {post.author.displayName}
            </span>
            <div className="flex items-center gap-1">
              <ClapCounter post={post} />
              <SaveButton postId={post.id} />
            </div>
          </div>
        )}
      </article>
    )
  }

  // ── 2. HERO: "ABOVE THE FOLD" LEAD STORY ────────────────────────────────
  if (variant === "hero") {
    return (
      <article className={cn("flex flex-col h-full", className)}>
        {/* Kicker bar */}
        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--border)]">
          <span className="font-mono text-xs uppercase tracking-widest font-bold text-[var(--accent)]">
            {topic?.name ? topic.name.toUpperCase() : "COVER STORY"}
          </span>
          <span className="text-[var(--border)]">/</span>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--fg-muted)]">
            SPECIAL REPORT
          </span>
          {post.paywallTier !== "FREE" && (
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-muted)]">
              <Lock className="w-3 h-3 text-[var(--accent)]" /> {post.paywallTier}
            </span>
          )}
        </div>

        {/* Lead Headline */}
        <Link href={href} className="group block">
          <h2 className="font-serif font-black text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
            {post.title}
          </h2>
        </Link>

        {/* Editorial Deck / Sub-headline */}
        {post.subtitle && (
          <p className="mt-3 font-serif italic text-lg sm:text-xl text-[var(--fg-secondary)] leading-relaxed">
            {post.subtitle}
          </p>
        )}

        {/* Byline & Dateline */}
        <div className="mt-4 pt-2.5 pb-2 border-t border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono uppercase text-[var(--fg-muted)]">
          <div>
            <span className="text-[var(--fg)] font-bold">BY {post.author.displayName.toUpperCase()}</span>
            <span className="mx-2 text-[var(--border)]">/</span>
            <span>{post.author.bio?.split(".")[0] || "CONTRIBUTOR"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{post.readingTimeMin} MIN READ</span>
            <span className="text-[var(--border)]">/</span>
            <span>{formatRelativeDate(post.publishedAt).toUpperCase()}</span>
          </div>
        </div>

        {/* Photo & Lead Copy */}
        {post.coverImageUrl && (
          <div className="mt-4 mb-4">
            <div className="relative aspect-[16/9] w-full overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)]">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                className="object-cover broadsheet-photo"
                priority
                unoptimized
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-[var(--fg-subtle)] px-0.5">
              <span className="italic font-serif">Photograph courtesy of the author</span>
              <span className="uppercase tracking-wider">PRISM ARCHIVE</span>
            </div>
          </div>
        )}

        {/* Traditional Lead Paragraph with Drop Cap */}
        <div className="mt-2 text-base sm:text-lg font-serif text-[var(--fg)] leading-relaxed">
          <p className="drop-cap">
            {post.excerpt ||
              "The structural mechanics of modern digital infrastructure demand rigorous re-examination. As centralised aggregators impose synthetic attention loops and extractive paywall barriers, independent writers and technologists are rediscovering the enduring authority of direct publishing."}
          </p>
        </div>

        {/* Read dispatch link & interactions */}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--border)]">
          <Link
            href={href}
            className="font-mono text-xs uppercase tracking-wider font-bold text-[var(--fg)] hover:text-[var(--accent)] hover:underline underline-offset-4 flex items-center gap-1.5"
          >
            <span>Continue Reading &rarr;</span>
          </Link>
          <div className="flex items-center gap-2">
            <ClapCounter post={post} />
            <SaveButton postId={post.id} />
          </div>
        </div>
      </article>
    )
  }

  // ── 3. TILE / FEATURED: BELOW-THE-FOLD EDITORIAL COLUMNS ────────────────
  if (variant === "tile" || variant === "featured") {
    return (
      <article
        className={cn(
          "flex flex-col h-full bg-[var(--panel)] border border-[var(--border)] p-4 sm:p-5 hover:border-[var(--border-strong)] transition-colors",
          className
        )}
      >
        {/* Kicker */}
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)] pb-2 mb-3 border-b border-[var(--border)]">
          <span className="font-bold text-[var(--accent)]">{topic?.name ?? "DISPATCH"}</span>
          <span>{post.readingTimeMin} MIN</span>
        </div>

        {/* Image if available */}
        {post.coverImageUrl && (
          <div className="relative aspect-[16/10] w-full overflow-hidden mb-3 border border-[var(--border)] bg-[var(--surface)]">
            <Image
              src={post.coverImageUrl}
              alt=""
              fill
              className="object-cover broadsheet-photo"
              unoptimized
            />
          </div>
        )}

        {/* Headline */}
        <Link href={href} className="group block">
          <h3 className="font-serif font-bold text-xl sm:text-2xl leading-tight text-[var(--fg)] group-hover:text-[var(--accent)] group-hover:underline underline-offset-2 transition-colors">
            {post.title}
          </h3>
        </Link>

        {/* Excerpt / Subtitle */}
        <p className="mt-2.5 font-serif text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-3">
          {post.subtitle || post.excerpt}
        </p>

        {/* Byline and Footer */}
        <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-mono text-[var(--fg-muted)]">
          <span className="uppercase text-[var(--fg)] font-semibold truncate max-w-[140px]">
            {post.author.displayName}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <ClapCounter post={post} />
            <SaveButton postId={post.id} />
          </div>
        </div>
      </article>
    )
  }

  // ── 4. DEFAULT: EDITORIAL LIST ROW WITH HAIRLINE DIVIDER ────────────────
  return (
    <article
      className={cn(
        "py-5 border-b border-[var(--border)] grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4 items-start",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">
          <span className="font-bold text-[var(--accent)]">{topic?.name ?? "FEATURE"}</span>
          <span className="text-[var(--border)]">/</span>
          <span>{post.readingTimeMin} MIN READ</span>
          {post.paywallTier !== "FREE" && (
            <>
              <span className="text-[var(--border)]">/</span>
              <span className="text-[var(--accent)] font-semibold flex items-center gap-0.5">
                <Lock className="w-3 h-3" />
                {post.paywallTier}
              </span>
            </>
          )}
        </div>

        <Link href={href} className="group block">
          <h3 className="font-serif font-bold text-xl sm:text-2xl leading-tight text-[var(--fg)] group-hover:text-[var(--accent)] group-hover:underline underline-offset-2 transition-colors">
            {post.title}
          </h3>
        </Link>

        <p className="mt-2 font-serif text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-2">
          {post.subtitle || post.excerpt}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs font-mono text-[var(--fg-subtle)]">
          <span className="uppercase text-[var(--fg-secondary)] font-medium">
            BY {post.author.displayName} &bull; {formatRelativeDate(post.publishedAt).toUpperCase()}
          </span>
          <div className="flex items-center gap-1">
            <ClapCounter post={post} />
            <SaveButton postId={post.id} />
          </div>
        </div>
      </div>

      {post.coverImageUrl && (
        <div className="relative aspect-[4/3] w-full sm:w-[160px] overflow-hidden border border-[var(--border)] bg-[var(--surface)] order-first sm:order-last">
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            className="object-cover broadsheet-photo"
            unoptimized
          />
        </div>
      )}
    </article>
  )
}

function ClapCounter({ post }: { post: Post }) {
  const { clappedPosts, clapPost } = useUIStore()
  const userClaps = clappedPosts[post.id] ?? 0

  const clap = () => {
    if (userClaps >= 50) return
    clapPost(post.id, 1)
  }

  return (
    <button
      type="button"
      onClick={clap}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 text-xs font-mono border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer",
        userClaps > 0 ? "text-[var(--accent)] font-bold" : "text-[var(--fg-muted)]"
      )}
      title={`Applaud (${numberWithCommas(post.clapCount + userClaps)})`}
    >
      <HandHeart className="w-3.5 h-3.5" />
      <span>{numberWithCommas(post.clapCount + userClaps)}</span>
    </button>
  )
}

function SaveButton({ postId }: { postId: string }) {
  const { bookmarkedPosts, toggleBookmark } = useUIStore()
  const saved = bookmarkedPosts.has(postId)

  const onClick = () => {
    toggleBookmark(postId)
    toast(
      saved ? "Removed from library" : "Archived in library",
      saved ? undefined : { tone: "success", action: { label: "View", href: "/bookmarks" } }
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border border-[var(--border)] border-transparent transition-colors cursor-pointer"
      title={saved ? "Remove from archive" : "Archive story"}
    >
      {saved ? (
        <BookmarkCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
      ) : (
        <Bookmark className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
