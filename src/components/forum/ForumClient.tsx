"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, ChevronDown, Clock, Flame, Link2, MessageCircle, MessagesSquare, PenLine, Search, Trash2, X } from "lucide-react"
import { PillTabs } from "@/components/discovery/PillTabs"
import { EmptyState } from "@/components/discovery/EmptyState"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { DEFAULT_AVATAR } from "@/lib/live/schema"
import { usePublishedPosts } from "@/lib/live/hooks"
import {
  BODY_MAX,
  REPLIES,
  THREADS,
  TITLE_MAX,
  useForumActions,
  useReplies,
  useThreads,
  type ForumReply,
  type ForumThread,
} from "@/lib/forum"
import { dur, ease } from "@/lib/motion"
import { toast, useUIStore } from "@/lib/store"
import { hueStyle, TOPICS } from "@/lib/topics"
import { cn, formatRelativeDate } from "@/lib/utils"
import { safeHref } from "@/lib/sanitize"

type Sort = "latest" | "discussed" | "unanswered"
const topicName = (slug: string) => TOPICS.find((t) => t.slug === slug)?.name ?? slug
const when = (ms: number) => (ms ? formatRelativeDate(new Date(ms)) : "")

/* ── Badges: live from the users mirror and the published set ────────────── */

interface Badges {
  elite: boolean
  author: boolean
  panel: boolean
  published: number
}

function useBadges() {
  const users = useUIStore((s) => s.users)
  const posts = usePublishedPosts()
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of posts) counts.set(p.author.username, (counts.get(p.author.username) ?? 0) + 1)
    return (handle: string): Badges => {
      const u = users[handle]
      const published = counts.get(handle) ?? 0
      return { elite: u?.tier === "elite", author: published > 0, panel: !!u?.isPanelMember, published }
    }
  }, [users, posts])
}

function BadgeRow({ b, className }: { b: Badges; className?: string }) {
  if (!b.elite && !b.author && !b.panel) return null
  const chip = "inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tracking-wide border"
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {b.author && <span className={cn(chip, "border-[var(--border-strong)] text-[var(--fg-secondary)]")}>✦ Author</span>}
      {b.elite && <span className={cn(chip, "border-[var(--elite-line)] bg-[var(--elite-wash)] text-[var(--elite-ink)]")}>✦ Elite</span>}
      {b.panel && <span className={cn(chip, "border-[var(--craft-line)] bg-[var(--craft-wash)] text-[var(--craft-ink)]")}>⚖️ Panel</span>}
    </span>
  )
}

function Upvote({ count, active, onClick, label }: { count: number; active: boolean; onClick: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-pressed={active}
      aria-label={`${active ? "Remove upvote from" : "Upvote"} ${label} (${count})`}
      className={cn(
        "inline-flex items-center gap-1 h-7 px-2 rounded-full text-xs font-semibold tabular-nums border transition-colors",
        active
          ? "border-[var(--elite-line)] bg-[var(--elite-wash)] text-[var(--elite-ink)]"
          : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]"
      )}
    >
      <span aria-hidden className="text-[10px]">▲</span>
      {count}
    </motion.button>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export function ForumClient() {
  const { threads, loading } = useThreads()
  const actions = useForumActions()
  const badges = useBadges()
  const [sort, setSort] = useState<Sort>("latest")
  const [topic, setTopic] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  // /forum#thread-<id> opens that thread
  useEffect(() => {
    const m = /^#thread-(.+)$/.exec(window.location.hash)
    if (m) setOpenId(m[1])
  }, [])
  const toggle = (id: string) => {
    const next = openId === id ? null : id
    setOpenId(next)
    window.history.replaceState(null, "", next ? `#thread-${next}` : window.location.pathname)
  }

  const shown = useMemo(() => {
    let list = threads.filter((t) => !topic || t.topicTag === topic)
    if (sort === "unanswered") list = list.filter((t) => t.replyCount === 0)
    return [...list].sort((a, b) =>
      sort === "discussed" ? b.replyCount - a.replyCount || b.lastActivityAt - a.lastActivityAt : b.createdAt - a.createdAt
    )
  }, [threads, topic, sort])

  const participants = useMemo(() => new Set(threads.map((t) => t.authorHandle)), [threads])

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-24">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="meta">Discussions</p>
          <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem] leading-[0.98]">Talk it through.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--fg-muted)]">
            Questions, disagreements and follow-ups on the ideas in Prism stories, with the people who wrote them.
          </p>
        </div>
        {actions.me ? (
          <button
            type="button"
            onClick={() => setComposing((c) => !c)}
            aria-expanded={composing}
            className="self-start md:self-auto inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
          >
            {composing ? <X className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
            {composing ? "Close" : "Start a discussion"}
          </button>
        ) : (
          <Link
            href="/auth/login?redirectTo=/forum"
            className="self-start md:self-auto inline-flex items-center gap-2 h-11 px-5 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] text-sm font-medium hover:border-[var(--fg)] transition-colors"
          >
            Sign in to start a discussion
          </Link>
        )}
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Threads ───────────────────────────────────────────────── */}
        <div className="min-w-0">
          <AnimatePresence initial={false}>
            {composing && actions.me && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto", transition: { duration: dur.base, ease: ease.out } }}
                exit={{ opacity: 0, height: 0, transition: { duration: dur.fast, ease: ease.in } }}
                className="overflow-hidden"
              >
                <Composer
                  defaultTopic={topic}
                  onCancel={() => setComposing(false)}
                  onSubmit={async (input) => {
                    const id = await actions.startThread(input)
                    if (!id) return false
                    setComposing(false)
                    setSort("latest")
                    setOpenId(id)
                    toast("Discussion started", { tone: "success" })
                    return true
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-3">
            <PillTabs
              label="Sort discussions"
              value={sort}
              onChange={setSort}
              tabs={[
                { id: "latest", label: "Latest", icon: Clock },
                { id: "discussed", label: "Most discussed", icon: Flame },
                { id: "unanswered", label: "Unanswered", icon: MessageCircle, count: threads.filter((t) => t.replyCount === 0).length },
              ]}
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by topic">
              <TopicChip active={!topic} onClick={() => setTopic(null)}>
                All topics
              </TopicChip>
              {TOPICS.map((t) => (
                <TopicChip key={t.slug} slug={t.slug} active={topic === t.slug} onClick={() => setTopic(topic === t.slug ? null : t.slug)}>
                  {t.name}
                </TopicChip>
              ))}
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading discussions">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-28 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              threads.length === 0 ? (
                <EmptyState
                  icon={MessagesSquare}
                  title="No discussions yet"
                  body="Start the first thread: a question for a writer, a counter-argument, or a story worth talking about."
                />
              ) : (
                <div className="panel px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
                  {sort === "unanswered" ? "Every discussion here has a reply." : "No discussions match this filter yet."}
                </div>
              )
            ) : (
              <ul className="space-y-3">
                {shown.map((t) => (
                  <ThreadCard key={t.id} thread={t} open={openId === t.id} onToggle={() => toggle(t.id)} badges={badges} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Authors in the forum ──────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 self-start">
          <AuthorDirectory participants={participants} badges={badges} />
        </aside>
      </div>
    </div>
  )
}

function TopicChip({ slug, active, onClick, children }: { slug?: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={slug ? hueStyle(slug) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] border transition-colors",
        active
          ? slug
            ? "hue-wash hue-ink border-transparent font-medium"
            : "bg-[var(--fg)] text-[var(--bg)] border-transparent font-medium"
          : "border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)]"
      )}
    >
      {slug && <span className="w-1.5 h-1.5 rounded-full hue-dot" aria-hidden />}
      {children}
    </button>
  )
}

/* ── New thread ───────────────────────────────────────────────────────────── */

function Composer({
  defaultTopic,
  onCancel,
  onSubmit,
}: {
  defaultTopic: string | null
  onCancel: () => void
  onSubmit: (input: { title: string; body: string; topicTag: string; linked: { id: string; title: string; href: string } | null }) => Promise<boolean>
}) {
  const posts = usePublishedPosts()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [topicTag, setTopicTag] = useState<string>(defaultTopic ?? TOPICS[0].slug)
  const [linkedId, setLinkedId] = useState("")
  const [busy, setBusy] = useState(false)
  const ok = title.trim().length >= 6 && body.trim().length >= 10

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    const p = posts.find((x) => x.id === linkedId)
    const done = await onSubmit({
      title,
      body,
      topicTag,
      linked: p ? { id: p.id, title: p.title, href: `/${p.author.username}/${p.slug}` } : null,
    })
    setBusy(false)
    if (done) {
      setTitle("")
      setBody("")
      setLinkedId("")
    }
  }

  const field = "w-full rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[var(--bg)] px-3.5 outline-none focus:border-[var(--border-strong)] transition-colors"

  return (
    <form onSubmit={submit} className="panel p-5 sm:p-6 mb-6 space-y-4" aria-label="Start a discussion">
      <div>
        <label htmlFor="thread-title" className="meta">
          Title
        </label>
        <input
          id="thread-title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          placeholder="What do you want to talk about?"
          className={cn(field, "mt-1.5 h-11 font-display text-lg font-semibold")}
          required
        />
      </div>
      <div>
        <label htmlFor="thread-body" className="meta">
          Your post
        </label>
        <textarea
          id="thread-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          rows={5}
          placeholder="Set it up: the argument, the question, what you've read so far…"
          className={cn(field, "mt-1.5 py-2.5 leading-relaxed resize-y")}
          required
        />
        <p className="mt-1 text-right text-xs text-[var(--fg-subtle)] tabular-nums">
          {body.length}/{BODY_MAX}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="thread-topic" className="meta">
            Topic
          </label>
          <select id="thread-topic" value={topicTag} onChange={(e) => setTopicTag(e.target.value)} className={cn(field, "mt-1.5 h-10 text-sm")}>
            {TOPICS.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="thread-article" className="meta">
            Linked article <span className="normal-case tracking-normal text-[var(--fg-subtle)]">(optional)</span>
          </label>
          <ArticlePicker posts={posts} value={linkedId} onChange={setLinkedId} fieldClass={field} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ok || busy}
          className="h-10 px-5 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] disabled:opacity-40 transition-opacity"
        >
          {busy ? "Posting…" : "Post discussion"}
        </button>
      </div>
    </form>
  )
}

/** Searchable "linked article" field: type to filter published stories by title or author */
function ArticlePicker({
  posts,
  value,
  onChange,
  fieldClass,
}: {
  posts: ReturnType<typeof usePublishedPosts>
  value: string
  onChange: (id: string) => void
  fieldClass: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = posts.find((p) => p.id === value)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? posts.filter((p) => p.title.toLowerCase().includes(q) || p.author.displayName.toLowerCase().includes(q) || p.author.username.toLowerCase().includes(q))
      : posts
    return list.slice(0, 8)
  }, [posts, query])

  const pick = (id: string) => {
    onChange(id)
    setQuery("")
    setOpen(false)
  }

  if (selected) {
    return (
      <div className={cn(fieldClass, "mt-1.5 h-10 flex items-center gap-2 text-sm")}>
        <Link2 className="w-3.5 h-3.5 shrink-0 text-[var(--fg-muted)]" aria-hidden />
        <span className="truncate min-w-0 flex-1">
          {selected.title} <span className="text-[var(--fg-subtle)]">· {selected.author.displayName}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Remove linked article"
          className="shrink-0 -mr-1.5 p-1.5 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative mt-1.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--fg-subtle)] pointer-events-none" aria-hidden />
        <input
          id="thread-article"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="thread-article-list"
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder="Search articles by title or author"
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, matches.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault() // don't submit the form
              pick(matches[active].id)
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          className={cn(fieldClass, "h-10 pl-8 text-sm")}
        />
      </div>
      {open && (
        <ul
          id="thread-article-list"
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[var(--panel)] shadow-lg py-1"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-[var(--fg-muted)]">No articles match “{query.trim()}”.</li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: it fires before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(p.id)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("px-3.5 py-2 cursor-pointer text-sm", i === active && "bg-[var(--surface)]")}
              >
                <span className="block truncate text-[var(--fg)]">{p.title}</span>
                <span className="block truncate text-xs text-[var(--fg-subtle)]">{p.author.displayName}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

/* ── Thread ───────────────────────────────────────────────────────────────── */

function ThreadCard({
  thread: t,
  open,
  onToggle,
  badges,
}: {
  thread: ForumThread
  open: boolean
  onToggle: () => void
  badges: (handle: string) => Badges
}) {
  const actions = useForumActions()
  const upvoted = !!actions.me && t.upvoterIds.includes(actions.me.uid)
  const mine = actions.me?.uid === t.authorId

  return (
    <li id={`thread-${t.id}`} className={cn("panel overflow-hidden transition-colors scroll-mt-24", open && "border-[var(--border-strong)]")}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        className="p-5 sm:p-6 cursor-pointer hover:bg-[var(--bg-secondary)]/40 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
          {t.topicTag && (
            <span style={hueStyle(t.topicTag)} className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full hue-wash hue-ink font-medium">
              <span className="w-1.5 h-1.5 rounded-full hue-dot" aria-hidden />
              {topicName(t.topicTag)}
            </span>
          )}
          {t.replyCount === 0 && <span className="inline-flex items-center h-6 px-2 rounded-full border border-[var(--border)]">Unanswered</span>}
          <span>{when(t.createdAt)}</span>
        </div>
        <h2 className="mt-2.5 font-display text-xl font-semibold leading-snug">{t.title}</h2>
        <p className={cn("mt-1.5 text-[15px] leading-relaxed text-[var(--fg-secondary)] whitespace-pre-line", !open && "line-clamp-2")}>{t.body}</p>
        {safeHref(t.linkedArticleHref)?.startsWith("/") && t.linkedArticleTitle && (
          <Link
            href={safeHref(t.linkedArticleHref)!}
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex max-w-full items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[13px] text-[var(--fg-secondary)] hover:border-[var(--border-strong)]"
          >
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.linkedArticleTitle}</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
          </Link>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={t.authorAvatar || DEFAULT_AVATAR(t.authorHandle)} alt={t.authorName} size="xs" />
            <Link href={`/${t.authorHandle}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium truncate hover:underline">
              {t.authorName}
            </Link>
            <BadgeRow b={badges(t.authorHandle)} />
          </div>
          <div className="flex items-center gap-2">
            <Upvote count={t.upvoterIds.length} active={upvoted} label="this discussion" onClick={() => actions.toggleUpvote(THREADS, t.id, upvoted)} />
            <span className="inline-flex items-center gap-1 h-7 px-2 text-xs text-[var(--fg-muted)] tabular-nums">
              <MessageCircle className="w-3.5 h-3.5" /> {t.replyCount}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-[var(--fg-subtle)] transition-transform", open && "rotate-180")} aria-hidden />
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, height: 0, transition: { duration: dur.fast, ease: ease.in } }}
            className="overflow-hidden"
          >
            <ThreadReplies thread={t} badges={badges} canDeleteThread={mine} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function ThreadReplies({ thread, badges, canDeleteThread }: { thread: ForumThread; badges: (h: string) => Badges; canDeleteThread: boolean }) {
  const { replies, loading } = useReplies(thread.id)
  const actions = useForumActions()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const children = useMemo(() => {
    const map = new Map<string | null, ForumReply[]>()
    const known = new Set(replies.map((r) => r.id))
    for (const r of replies) {
      const parent = r.parentId && known.has(r.parentId) ? r.parentId : null
      map.set(parent, [...(map.get(parent) ?? []), r])
    }
    return map
  }, [replies])

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg)]/60 px-5 sm:px-6 py-5">
      {loading ? (
        <div className="h-16 rounded-xl bg-[var(--surface)] animate-pulse" aria-busy="true" />
      ) : replies.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">No replies yet. Be the first to answer.</p>
      ) : (
        <ReplyList parentId={null} tree={children} depth={0} badges={badges} thread={thread} />
      )}

      <div className="mt-5">
        <ReplyBox threadId={thread.id} parentId={null} placeholder="Add to the discussion…" />
      </div>

      {canDeleteThread && (
        <div className="mt-4 flex justify-end items-center gap-2 text-xs">
          {confirmDelete ? (
            <>
              <span className="text-[var(--fg-muted)]">Delete this discussion and its replies?</span>
              <button
                type="button"
                onClick={async () => {
                  if (await actions.deleteThread(thread.id)) toast("Discussion deleted")
                }}
                className="h-7 px-3 rounded-full font-medium bg-[var(--danger-ink)] text-white"
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-7 px-3 rounded-full border border-[var(--border-strong)]">
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-[var(--fg-subtle)] hover:text-[var(--danger-ink)]"
            >
              <Trash2 className="w-3 h-3" /> Delete discussion
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ReplyList({
  parentId,
  tree,
  depth,
  badges,
  thread,
}: {
  parentId: string | null
  tree: Map<string | null, ForumReply[]>
  depth: number
  badges: (h: string) => Badges
  thread: ForumThread
}) {
  const list = tree.get(parentId) ?? []
  if (!list.length) return null
  return (
    <ul className={cn("space-y-4", depth > 0 && "mt-4 pl-4 sm:pl-5 border-l border-[var(--border-strong)]/60")}>
      {list.map((r) => (
        <ReplyItem key={r.id} reply={r} tree={tree} depth={depth} badges={badges} thread={thread} />
      ))}
    </ul>
  )
}

function ReplyItem({
  reply: r,
  tree,
  depth,
  badges,
  thread,
}: {
  reply: ForumReply
  tree: Map<string | null, ForumReply[]>
  depth: number
  badges: (h: string) => Badges
  thread: ForumThread
}) {
  const actions = useForumActions()
  const [replying, setReplying] = useState(false)
  const upvoted = !!actions.me && r.upvoterIds.includes(actions.me.uid)
  const mine = actions.me?.uid === r.authorId
  const isOp = r.authorId === thread.authorId

  return (
    <li>
      <div className="flex items-start gap-3">
        <Avatar src={r.authorAvatar || DEFAULT_AVATAR(r.authorHandle)} alt={r.authorName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/${r.authorHandle}`} className="text-sm font-semibold hover:underline">
              {r.authorName}
            </Link>
            {isOp && <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">OP</span>}
            <BadgeRow b={badges(r.authorHandle)} />
            <span className="text-xs text-[var(--fg-subtle)]">{when(r.createdAt)}</span>
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-[var(--fg-secondary)] whitespace-pre-line break-words">{r.body}</p>
          <div className="mt-2 flex items-center gap-3">
            <Upvote count={r.upvoterIds.length} active={upvoted} label={`reply by ${r.authorName}`} onClick={() => actions.toggleUpvote(REPLIES, r.id, upvoted)} />
            {actions.me && depth < 4 && (
              <button type="button" onClick={() => setReplying((v) => !v)} className="text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
                {replying ? "Cancel" : "Reply"}
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() => actions.deleteReply(r)}
                className="inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)] hover:text-[var(--danger-ink)]"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
          {replying && (
            <div className="mt-3">
              <ReplyBox threadId={r.threadId} parentId={r.id} placeholder={`Reply to ${r.authorName}…`} onDone={() => setReplying(false)} autoFocus />
            </div>
          )}
          <ReplyList parentId={r.id} tree={tree} depth={depth + 1} badges={badges} thread={thread} />
        </div>
      </div>
    </li>
  )
}

function ReplyBox({
  threadId,
  parentId,
  placeholder,
  onDone,
  autoFocus,
}: {
  threadId: string
  parentId: string | null
  placeholder: string
  onDone?: () => void
  autoFocus?: boolean
}) {
  const actions = useForumActions()
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)

  if (!actions.me)
    return (
      <p className="text-sm text-[var(--fg-muted)]">
        <Link href="/auth/login?redirectTo=/forum" className="font-medium text-[var(--fg)] underline underline-offset-4">
          Sign in
        </Link>{" "}
        to join the discussion.
      </p>
    )

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (body.trim().length < 2 || busy) return
        setBusy(true)
        const ok = await actions.reply(threadId, body, parentId)
        setBusy(false)
        if (ok) {
          setBody("")
          onDone?.()
        }
      }}
      className="flex items-end gap-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2.5 text-[15px] leading-relaxed outline-none focus:border-[var(--border-strong)] resize-y"
      />
      <button
        type="submit"
        disabled={body.trim().length < 2 || busy}
        className="h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] disabled:opacity-40 transition-opacity shrink-0"
      >
        {busy ? "…" : "Reply"}
      </button>
    </form>
  )
}

/* ── Authors in the forum ─────────────────────────────────────────────────── */

function AuthorDirectory({ participants, badges }: { participants: Set<string>; badges: (h: string) => Badges }) {
  const users = useUIStore((s) => s.users)
  const usersReady = useUIStore((s) => s.live.users)

  const authors = useMemo(
    () =>
      Object.values(users)
        .filter((u) => !u.suspended)
        .map((u) => ({ u, b: badges(u.handle), inForum: participants.has(u.handle) }))
        .filter((x) => x.b.published > 0 || x.inForum)
        .sort((a, b) => b.b.published - a.b.published || Number(b.inForum) - Number(a.inForum) || a.u.displayName.localeCompare(b.u.displayName))
        .slice(0, 12),
    [users, badges, participants]
  )

  return (
    <section className="panel p-5" aria-labelledby="forum-authors">
      <h2 id="forum-authors" className="font-display text-lg font-semibold tracking-tight">
        Authors in the forum
      </h2>
      <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Prism writers and members taking part.</p>
      {!usersReady ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      ) : authors.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">Writers appear here once they publish or join a discussion.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {authors.map(({ u, b, inForum }) => (
            <li key={u.uid} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <Avatar src={u.photoURL || DEFAULT_AVATAR(u.handle)} alt={u.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Link href={`/${u.handle}`} className="text-sm font-semibold truncate hover:underline">
                      {u.displayName}
                    </Link>
                    {b.elite ? (
                      <span className="shrink-0 text-[10.5px] font-semibold text-[var(--elite-ink)]">✦ Elite</span>
                    ) : b.author ? (
                      <span className="shrink-0 text-[10.5px] font-semibold text-[var(--fg-muted)]">Author</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[var(--fg-muted)] truncate">
                    @{u.handle} · {b.published} published{inForum ? " · in discussions" : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <FollowButton username={u.handle} displayName={u.displayName} size="sm" tone="outline" className="h-7 px-3" />
                    <Link
                      href={`/${u.handle}`}
                      className="inline-flex items-center h-7 px-3 rounded-full text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
                    >
                      View profile
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
