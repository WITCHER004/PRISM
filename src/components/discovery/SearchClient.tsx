"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, BadgeCheck, CornerDownLeft, History, Search, SearchX, X } from "lucide-react"
import { MOCK_POSTS, MOCK_TAGS, SAMPLE_WRITERS, type Post, type Tag, type User } from "@/lib/data"
import { Avatar } from "@/components/ui/Avatar"
import { FollowButton } from "@/components/ui/FollowButton"
import { PillTabs } from "./PillTabs"
import { Highlight, snippet } from "./Highlight"
import { useRecentSearches } from "./hooks"
import { hueStyle } from "@/lib/topics"
import { dur, ease, spring, stagger } from "@/lib/motion"
import { cn, numberWithCommas } from "@/lib/utils"

type Tab = "all" | "stories" | "people" | "topics"
type Item = { key: string; href: string }

const SUGGESTIONS = ["saga", "design tokens", "climate", "AI policy", "feeds"]
const ALL_LIMIT = { stories: 4, people: 3, topics: 4 }

// ── matching ────────────────────────────────────────────────────────────────
const termsOf = (q: string) => [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))]
const hasAll = (hay: string, terms: string[]) => terms.every((t) => hay.includes(t))
const hits = (s: string | undefined, terms: string[]) => (s ? terms.filter((t) => s.toLowerCase().includes(t)).length : 0)

function searchStories(terms: string[]): Post[] {
  return MOCK_POSTS.map((p) => {
    const tagText = p.tags.map((t) => `${t.name} ${t.slug}`).join(" ")
    const hay = [p.title, p.subtitle, p.excerpt, tagText, p.author.displayName].join(" ").toLowerCase()
    if (!hasAll(hay, terms)) return null
    const score = hits(p.title, terms) * 4 + hits(tagText, terms) * 2 + hits(p.subtitle, terms) + hits(p.excerpt, terms)
    return { p, score }
  })
    .filter((x): x is { p: Post; score: number } => !!x)
    .sort((a, b) => b.score - a.score || b.p.clapCount - a.p.clapCount)
    .map((x) => x.p)
}

function searchPeople(terms: string[]): User[] {
  return SAMPLE_WRITERS.filter((u) => hasAll(`${u.displayName} ${u.username} ${u.bio}`.toLowerCase(), terms)).sort(
    (a, b) => hits(`${b.displayName} ${b.username}`, terms) - hits(`${a.displayName} ${a.username}`, terms) || b.followerCount - a.followerCount
  )
}

function searchTopics(terms: string[]): Tag[] {
  return MOCK_TAGS.filter((t) => hasAll(`${t.name} ${t.slug}`.toLowerCase(), terms))
}

// ── component ───────────────────────────────────────────────────────────────
export function SearchClient() {
  const router = useRouter()
  const params = useSearchParams()
  const urlQ = params.get("q") ?? ""
  const [query, setQuery] = useState(urlQ)
  const [tab, setTab] = useState<Tab>("all")
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastWritten = useRef(urlQ)
  const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches()
  const baseId = useId()

  // URL → input, when the URL changes from outside (back/forward, header ⌘K)
  useEffect(() => {
    if (urlQ !== lastWritten.current) {
      lastWritten.current = urlQ
      setQuery(urlQ)
    }
  }, [urlQ])

  // input → URL, debounced so typing doesn't flood history
  useEffect(() => {
    const q = query.trim()
    if (q === lastWritten.current) return
    const t = setTimeout(() => {
      lastWritten.current = q
      router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false })
    }, 300)
    return () => clearTimeout(t)
  }, [query, router])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const terms = useMemo(() => termsOf(query), [query])
  const stories = useMemo(() => (terms.length ? searchStories(terms) : []), [terms])
  const people = useMemo(() => (terms.length ? searchPeople(terms) : []), [terms])
  const topics = useMemo(() => (terms.length ? searchTopics(terms) : []), [terms])
  const total = stories.length + people.length + topics.length

  // What's on screen for this tab, in render order — the keyboard walks this list
  const shown = useMemo(() => {
    const all = tab === "all"
    return {
      stories: tab === "stories" || all ? (all ? stories.slice(0, ALL_LIMIT.stories) : stories) : [],
      people: tab === "people" || all ? (all ? people.slice(0, ALL_LIMIT.people) : people) : [],
      topics: tab === "topics" || all ? (all ? topics.slice(0, ALL_LIMIT.topics) : topics) : [],
    }
  }, [tab, stories, people, topics])

  const items: Item[] = useMemo(
    () => [
      ...shown.stories.map((p) => ({ key: `s-${p.id}`, href: `/${p.author.username}/${p.slug}` })),
      ...shown.people.map((u) => ({ key: `u-${u.username}`, href: `/${u.username}` })),
      ...shown.topics.map((t) => ({ key: `t-${t.slug}`, href: `/explore/${t.slug}` })),
    ],
    [shown]
  )
  const indexOf = (key: string) => items.findIndex((i) => i.key === key)

  // Reset the cursor whenever the result set changes
  useEffect(() => setActive(-1), [query, tab])

  // Keep the highlighted result in view
  useEffect(() => {
    if (active < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const commit = (q = query) => addRecent(q)

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (items.length) setActive((a) => (a + 1) % items.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (items.length) setActive((a) => (a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (!query.trim()) return
      commit()
      if (active >= 0 && items[active]) router.push(items[active].href)
      else if (items.length) setActive(0)
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (query) setQuery("")
      else inputRef.current?.blur()
    }
  }

  const runSearch = (q: string) => {
    setQuery(q)
    setTab("all")
    inputRef.current?.focus()
  }

  const tabs = [
    { id: "all" as const, label: "All", count: terms.length ? total : undefined },
    { id: "stories" as const, label: "Stories", count: terms.length ? stories.length : undefined },
    { id: "people" as const, label: "People", count: terms.length ? people.length : undefined },
    { id: "topics" as const, label: "Topics", count: terms.length ? topics.length : undefined },
  ]

  const optionProps = (key: string) => {
    const i = indexOf(key)
    return {
      id: `${baseId}-opt-${i}`,
      "data-index": i,
      role: "option" as const,
      "aria-selected": i === active,
      onMouseMove: () => active !== i && setActive(i),
      onClick: () => commit(),
      active: i === active,
    }
  }

  const tabEmpty = terms.length > 0 && items.length === 0

  return (
    <div className="mt-8">
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--fg-muted)]" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-label="Search stories, people and topics"
          aria-expanded={items.length > 0}
          aria-controls={`${baseId}-results`}
          aria-activedescendant={active >= 0 ? `${baseId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search stories, people, topics…"
          className="w-full h-14 pl-13 pr-14 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] text-[var(--fg)] text-lg placeholder:text-[var(--fg-subtle)] shadow-[var(--shadow)] focus:outline-none focus:border-[var(--fg)] transition-colors"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: dur.fast } }}
              onClick={() => {
                setQuery("")
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 hidden sm:flex items-center gap-3 meta">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="w-3 h-3" />
          </Kbd>{" "}
          to open
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>esc</Kbd> to clear
        </span>
      </p>

      {terms.length > 0 && (
        <div className="mt-6">
          <PillTabs label="Result type" tabs={tabs} value={tab} onChange={setTab} panelId={`${baseId}-panel`} />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {terms.length ? `${total} results for ${query}` : ""}
      </p>

      <div ref={listRef} id={`${baseId}-results`} role="listbox" aria-label="Search results" className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          {!terms.length ? (
            <Fade key="idle">
              <IdleState
                recent={recent}
                onPick={runSearch}
                onRemove={removeRecent}
                onClear={clearRecent}
              />
            </Fade>
          ) : total === 0 ? (
            <Fade key="none">
              <NoResults query={query.trim()} onPick={runSearch} />
            </Fade>
          ) : tabEmpty ? (
            <Fade key={`empty-${tab}`}>
              <div className="panel p-8 text-center">
                <p className="text-[var(--fg-muted)]">
                  No {tab} match &ldquo;{query.trim()}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className="mt-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm hover:border-[var(--border-strong)] transition-colors"
                >
                  See all {total} results <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </Fade>
          ) : (
            <Fade key={`tab-${tab}`} id={`${baseId}-panel-${tab}`}>
              <div className="space-y-10">
                {shown.stories.length > 0 && (
                  <Group
                    title="Stories"
                    more={tab === "all" && stories.length > shown.stories.length ? () => setTab("stories") : undefined}
                    total={stories.length}
                  >
                    <div className="relative space-y-2">
                      <AnimatePresence initial={false} mode="popLayout">
                        {shown.stories.map((p, i) => (
                          <Row key={p.id} i={i}>
                            <StoryResult post={p} terms={terms} {...optionProps(`s-${p.id}`)} />
                          </Row>
                        ))}
                      </AnimatePresence>
                    </div>
                  </Group>
                )}
                {shown.people.length > 0 && (
                  <Group
                    title="People"
                    more={tab === "all" && people.length > shown.people.length ? () => setTab("people") : undefined}
                    total={people.length}
                  >
                    <div className="relative space-y-2">
                      <AnimatePresence initial={false} mode="popLayout">
                        {shown.people.map((u, i) => (
                          <Row key={u.username} i={i}>
                            <PersonResult user={u} terms={terms} {...optionProps(`u-${u.username}`)} />
                          </Row>
                        ))}
                      </AnimatePresence>
                    </div>
                  </Group>
                )}
                {shown.topics.length > 0 && (
                  <Group
                    title="Topics"
                    more={tab === "all" && topics.length > shown.topics.length ? () => setTab("topics") : undefined}
                    total={topics.length}
                  >
                    <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <AnimatePresence initial={false} mode="popLayout">
                        {shown.topics.map((t, i) => (
                          <Row key={t.slug} i={i}>
                            <TopicResult tag={t} terms={terms} {...optionProps(`t-${t.slug}`)} />
                          </Row>
                        ))}
                      </AnimatePresence>
                    </div>
                  </Group>
                )}
              </div>
            </Fade>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── pieces ──────────────────────────────────────────────────────────────────
function Fade({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <motion.div
      id={id}
      role="presentation"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
      exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
    >
      {children}
    </motion.div>
  )
}

function Row({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <motion.div
      layout
      role="presentation"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out, delay: i * stagger } }}
      exit={{ opacity: 0, transition: { duration: dur.fast } }}
      transition={{ layout: spring.soft }}
    >
      {children}
    </motion.div>
  )
}

function Group({ title, total, more, children }: { title: string; total: number; more?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="meta">
          {title} · {total}
        </h2>
        {more && (
          <button
            type="button"
            onClick={more}
            className="inline-flex items-center gap-1 h-9 px-3 -mr-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
          >
            See all {total} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

type OptionProps = {
  id: string
  "data-index": number
  role: "option"
  "aria-selected": boolean
  onMouseMove: () => void
  onClick: () => void
  active: boolean
}

const optionClass = (active: boolean) =>
  cn(
    "group relative flex gap-4 p-3 sm:p-4 rounded-[var(--radius-card)] border transition-colors",
    active
      ? "bg-[var(--panel)] border-[var(--border-strong)] shadow-[var(--shadow)]"
      : "border-transparent hover:bg-[var(--panel)]"
  )

function StoryResult({ post, terms, active, ...rest }: { post: Post; terms: string[] } & OptionProps) {
  const topic = post.tags[0]
  const body = snippet(post.subtitle && hits(post.subtitle, terms) ? post.subtitle : post.excerpt, terms)
  return (
    <Link href={`/${post.author.username}/${post.slug}`} className={optionClass(active)} style={hueStyle(topic?.slug)} {...rest}>
      <div className="min-w-0 flex-1">
        {topic && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full hue-wash hue-ink text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full hue-dot" />
            <Highlight text={topic.name} terms={terms} />
          </span>
        )}
        <h3 className="mt-2 font-display font-semibold text-[1.0625rem] sm:text-[1.1875rem] leading-snug tracking-[-0.015em] text-[var(--fg)] line-clamp-2">
          <Highlight text={post.title} terms={terms} />
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)] line-clamp-2">
          <Highlight text={body} terms={terms} />
        </p>
        <p className="mt-2 meta">
          {post.author.displayName} · {post.readingTimeMin} min · {numberWithCommas(post.clapCount)} claps
        </p>
      </div>
      {post.coverImageUrl && (
        <div className="relative hidden sm:block w-24 h-24 shrink-0 rounded-[14px] overflow-hidden bg-[var(--surface)]">
          <Image src={post.coverImageUrl} alt="" fill className="object-cover" unoptimized />
        </div>
      )}
      <ArrowRight
        className={cn(
          "absolute right-3 top-3 w-4 h-4 text-[var(--fg-muted)] transition-[opacity,transform] duration-200 sm:hidden",
          active ? "opacity-100" : "opacity-0"
        )}
      />
    </Link>
  )
}

function PersonResult({ user, terms, active, ...rest }: { user: User; terms: string[] } & OptionProps) {
  return (
    <div className={cn(optionClass(active), "items-center")}>
      <Link href={`/${user.username}`} className="absolute inset-0 rounded-[var(--radius-card)]" aria-label={user.displayName} {...rest} />
      <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
      <div className="min-w-0 flex-1 pointer-events-none">
        <p className="flex items-center gap-1 font-semibold text-[var(--fg)]">
          <span className="truncate">
            <Highlight text={user.displayName} terms={terms} />
          </span>
          {user.isVerifiedHuman && <BadgeCheck className="w-4 h-4 shrink-0 text-[var(--accent)]" aria-label="Verified writer" />}
        </p>
        <p className="meta mt-0.5">
          @<Highlight text={user.username} terms={terms} /> · {numberWithCommas(user.followerCount)} readers
        </p>
        <p className="mt-1 text-sm text-[var(--fg-muted)] line-clamp-1">
          <Highlight text={snippet(user.bio, terms, 50)} terms={terms} />
        </p>
      </div>
      <div className="relative z-10">
        <FollowButton username={user.username} displayName={user.displayName} size="sm" tone="outline" />
      </div>
    </div>
  )
}

function TopicResult({ tag, terms, active, ...rest }: { tag: Tag; terms: string[] } & OptionProps) {
  return (
    <Link
      href={`/explore/${tag.slug}`}
      style={hueStyle(tag.slug)}
      className={cn(
        "flex items-center gap-3 h-16 px-4 rounded-[var(--radius-card)] hue-wash border transition-[border-color,box-shadow]",
        active ? "hue-border shadow-[var(--shadow)]" : "border-transparent"
      )}
      {...rest}
    >
      <span className="w-3 h-3 rounded-full hue-dot shrink-0" />
      <span className="flex-1 min-w-0 truncate font-display font-semibold hue-ink">
        <Highlight text={tag.name} terms={terms} />
      </span>
      <span className="meta">{numberWithCommas(tag.postCount ?? 0)}</span>
    </Link>
  )
}

function IdleState({
  recent,
  onPick,
  onRemove,
  onClear,
}: {
  recent: string[]
  onPick: (q: string) => void
  onRemove: (q: string) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-10">
      <AnimatePresence initial={false}>
        {recent.length > 0 && (
          <motion.section
            key="recent"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: dur.fast } }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="meta">Recent searches</h2>
              <button
                type="button"
                onClick={onClear}
                className="h-9 px-3 -mr-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
              >
                Clear
              </button>
            </div>
            <ul className="panel divide-y divide-[var(--border)] overflow-hidden">
              <AnimatePresence initial={false}>
                {recent.map((q) => (
                  <motion.li
                    key={q}
                    layout
                    exit={{ opacity: 0, x: -12, transition: { duration: dur.fast } }}
                    className="flex items-center"
                  >
                    <button
                      type="button"
                      onClick={() => onPick(q)}
                      className="flex-1 min-w-0 flex items-center gap-3 h-12 pl-4 text-left text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors"
                    >
                      <History className="w-4 h-4 shrink-0 text-[var(--fg-subtle)]" />
                      <span className="truncate">{q}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(q)}
                      aria-label={`Remove “${q}” from recent searches`}
                      className="grid place-items-center w-10 h-10 mr-1 rounded-full text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      <section>
        <h2 className="meta mb-3">Try searching for</h2>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[var(--fg-subtle)]" /> {s}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="meta mb-3">Browse topics</h2>
        <TopicChips />
      </section>
    </div>
  )
}

function NoResults({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  return (
    <div className="panel relative overflow-hidden px-6 py-14 text-center shadow-[var(--shadow)]">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 spectrum-bg opacity-80" />
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-secondary)]">
        <SearchX className="w-6 h-6" />
      </div>
      <h2 className="display mt-5 text-[1.5rem] sm:text-[1.75rem] break-words">Nothing matches &ldquo;{query}&rdquo;</h2>
      <p className="mt-2 mx-auto max-w-sm text-sm leading-relaxed text-[var(--fg-muted)]">
        Check the spelling, use fewer words, or try one of these instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.slice(0, 4).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="h-10 px-4 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      <Link
        href="/explore"
        className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
      >
        Explore all topics <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

function TopicChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {MOCK_TAGS.map((tag) => (
        <Link
          key={tag.slug}
          href={`/explore/${tag.slug}`}
          style={hueStyle(tag.slug)}
          className="inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg-secondary)] hover:hue-wash hover:hue-ink hover:border-transparent transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-full hue-dot" />
          {tag.name}
        </Link>
      ))}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid place-items-center min-w-5 h-5 px-1 rounded-[6px] border border-[var(--border)] bg-[var(--panel)] font-mono text-[0.625rem] text-[var(--fg-muted)] normal-case">
      {children}
    </kbd>
  )
}
