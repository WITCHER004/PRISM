"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, Check, Highlighter, History, Search, Trash2, X } from "lucide-react"
import { PillTabs } from "@/components/discovery/PillTabs"
import { EmptyState } from "@/components/discovery/EmptyState"
import { HIGHLIGHT_COLORS, useHighlightActions, useMyHighlights, type PrivateHighlight } from "@/lib/highlights"
import { useReadingHistory, type HistoryEntry } from "@/lib/readingProgress"
import { dur, ease } from "@/lib/motion"
import { toast } from "@/lib/store"
import { cn, formatRelativeDate } from "@/lib/utils"

type Tab = "highlights" | "history"
const TABS: Tab[] = ["highlights", "history"]
const tabFromHash = (): Tab | null => {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1)
  return (TABS as string[]).includes(h) ? (h as Tab) : null
}

const swatch = (c: PrivateHighlight["color"]) => HIGHLIGHT_COLORS.find((x) => x.id === c)?.swatch ?? "#e9b44c"
const matches = (q: string, ...fields: string[]) => {
  const needle = q.trim().toLowerCase()
  return !needle || fields.some((f) => f.toLowerCase().includes(needle))
}

/** The signed-in reader's own library: private highlights and reading history (Profile Hub) */
export function ReadingVault() {
  const [tab, setTab] = useState<Tab>("highlights")
  const sectionRef = useRef<HTMLElement>(null)
  const { highlights, loading: hlLoading } = useMyHighlights()
  const history = useReadingHistory()

  // /profile#highlights and /profile#history (the account menu) open the matching tab
  useEffect(() => {
    const sync = () => {
      const t = tabFromHash()
      if (!t) return
      setTab(t)
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  const choose = (t: Tab) => {
    setTab(t)
    window.history.replaceState(null, "", `#${t}`)
  }

  return (
    <section id="reading" ref={sectionRef} className="mt-10 scroll-mt-24" aria-labelledby="reading-title">
      <h2 id="reading-title" className="display text-[1.75rem]">
        Your reading
      </h2>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">Only you can see this: passages you kept, and everything you've read.</p>

      <PillTabs
        className="mt-5"
        label="Your reading"
        panelId="reading"
        value={tab}
        onChange={choose}
        tabs={[
          { id: "highlights", label: "Private highlights", icon: Highlighter, count: hlLoading ? undefined : highlights.length },
          { id: "history", label: "Reading history", icon: History, count: history.loading ? undefined : history.items.length },
        ]}
      />

      <div className="mt-5" role="tabpanel" id={`reading-${tab}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
          >
            {tab === "highlights" ? (
              <HighlightsPanel highlights={highlights} loading={hlLoading} />
            ) : (
              <HistoryPanel {...history} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2 h-10 px-3.5 rounded-full bg-[var(--panel)] border border-[var(--border)] focus-within:border-[var(--border-strong)] transition-colors w-full sm:w-80">
      <Search className="w-4 h-4 text-[var(--fg-subtle)] shrink-0" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full min-w-0 bg-transparent outline-none text-sm placeholder:text-[var(--fg-subtle)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="text-[var(--fg-subtle)] hover:text-[var(--fg)]">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </label>
  )
}

const Skeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-20 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" />
    ))}
  </div>
)

/* ── Private highlights ──────────────────────────────────────────────────── */

function HighlightsPanel({ highlights, loading }: { highlights: PrivateHighlight[]; loading: boolean }) {
  const [q, setQ] = useState("")
  const { remove } = useHighlightActions()

  const groups = useMemo(() => {
    const byArticle = new Map<string, PrivateHighlight[]>()
    for (const h of highlights) {
      if (!matches(q, h.selectedText, h.personalNote, h.articleTitle, h.authorName)) continue
      byArticle.set(h.articleId, [...(byArticle.get(h.articleId) ?? []), h])
    }
    // Articles ordered by their newest highlight; passages in reading order
    return [...byArticle.values()]
      .map((list) => list.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.createdAt - b.createdAt))
      .sort((a, b) => Math.max(...b.map((h) => h.createdAt)) - Math.max(...a.map((h) => h.createdAt)))
  }, [highlights, q])

  if (loading) return <Skeleton />
  if (!highlights.length)
    return (
      <EmptyState
        icon={Highlighter}
        title="No highlights yet"
        body="Select any passage while reading and choose Private Highlight. It stays here, visible only to you."
        cta={{ label: "Find something to read", href: "/explore" }}
      />
    )

  return (
    <>
      <SearchField value={q} onChange={setQ} placeholder="Search your highlights" />
      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--fg-muted)]">No highlights match “{q}”.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map((list) => {
            const first = list[0]
            return (
              <article key={first.articleId} className="panel p-5 sm:p-6">
                <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    {first.articleHref ? (
                      <Link href={first.articleHref} className="font-display text-lg font-semibold leading-snug hover:underline underline-offset-4">
                        {first.articleTitle}
                      </Link>
                    ) : (
                      <p className="font-display text-lg font-semibold leading-snug">{first.articleTitle}</p>
                    )}
                    {first.authorName && <p className="text-xs text-[var(--fg-muted)] mt-0.5">by {first.authorName}</p>}
                  </div>
                  <span className="meta">
                    {list.length} {list.length === 1 ? "passage" : "passages"}
                  </span>
                </header>
                <ul className="mt-4 space-y-3">
                  {list.map((h) => (
                    <li key={h.id} className="group relative pl-4">
                      <span aria-hidden className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full" style={{ background: swatch(h.color) }} />
                      <blockquote className="font-serif text-[1.0625rem] leading-relaxed text-[var(--fg-secondary)] line-clamp-4 whitespace-pre-line">
                        {h.selectedText}
                      </blockquote>
                      {h.personalNote && (
                        <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                          <span className="font-medium text-[var(--fg-secondary)]">Note · </span>
                          {h.personalNote}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-subtle)]">
                        <span>
                          ¶ {h.paragraphIndex + 1} · {formatRelativeDate(new Date(h.createdAt))}
                        </span>
                        {h.articleHref && (
                          <Link
                            href={`${h.articleHref}#para-${h.paragraphIndex}`}
                            className="inline-flex items-center gap-0.5 font-medium text-[var(--fg-secondary)] hover:text-[var(--fg)]"
                          >
                            Jump to passage <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            remove(h.id)
                            toast("Highlight removed")
                          }}
                          className="inline-flex items-center gap-1 hover:text-[var(--danger-ink)] sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ── Reading history ─────────────────────────────────────────────────────── */

const BUCKETS = ["Today", "Yesterday", "This week", "Earlier"] as const
function bucketOf(ms: number, now = new Date()): (typeof BUCKETS)[number] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (ms >= startOfToday) return "Today"
  if (ms >= startOfToday - 86_400_000) return "Yesterday"
  if (ms >= startOfToday - 6 * 86_400_000) return "This week"
  return "Earlier"
}

function HistoryPanel({
  items,
  loading,
  remove,
  clearAll,
}: {
  items: HistoryEntry[]
  loading: boolean
  remove: (articleId: string) => Promise<void>
  clearAll: () => Promise<boolean>
}) {
  const [q, setQ] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  const grouped = useMemo(() => {
    const now = new Date()
    const out = new Map<(typeof BUCKETS)[number], HistoryEntry[]>()
    for (const h of items) {
      if (!matches(q, h.articleTitle, h.topic, h.authorName, h.articleSubtitle)) continue
      const b = bucketOf(h.lastVisitedAt, now)
      out.set(b, [...(out.get(b) ?? []), h])
    }
    return BUCKETS.filter((b) => out.has(b)).map((b) => [b, out.get(b)!] as const)
  }, [items, q])

  if (loading) return <Skeleton />
  if (!items.length)
    return (
      <EmptyState
        icon={History}
        title="Nothing read yet"
        body="Stories you open and read for a few seconds appear here, on every device you sign in on."
        cta={{ label: "Start reading", href: "/" }}
      />
    )

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchField value={q} onChange={setQ} placeholder="Search by title, topic or author" />
        <div className="flex items-center gap-2 shrink-0">
          {confirming ? (
            <>
              <span className="text-sm text-[var(--fg-muted)]">Clear all {items.length}?</span>
              <button
                type="button"
                disabled={clearing}
                onClick={async () => {
                  setClearing(true)
                  if (await clearAll()) toast("Reading history cleared")
                  setClearing(false)
                  setConfirming(false)
                }}
                className="h-9 px-3.5 rounded-full text-sm font-medium bg-[var(--danger-ink)] text-white disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Yes, clear"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-9 px-3.5 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium text-[var(--fg-muted)] border border-[var(--border)] hover:text-[var(--danger-ink)] hover:border-[var(--danger-ink)]/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all history
            </button>
          )}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--fg-muted)]">Nothing in your history matches “{q}”.</p>
      ) : (
        <div className="mt-6 space-y-7">
          {grouped.map(([bucket, list]) => (
            <div key={bucket}>
              <h3 className="meta mb-2">{bucket}</h3>
              <ul className="panel divide-y divide-[var(--border)] overflow-hidden">
                {list.map((h) => (
                  <HistoryRow key={h.id} entry={h} onRemove={() => remove(h.articleId)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function HistoryRow({ entry: h, onRemove }: { entry: HistoryEntry; onRemove: () => void }) {
  const done = h.progressPercent >= 90
  return (
    <li className="group flex items-start gap-4 p-4 sm:px-5">
      <div className="min-w-0 flex-1">
        {h.href ? (
          <Link href={h.href} className="font-semibold leading-snug line-clamp-1 hover:underline underline-offset-4">
            {h.articleTitle}
          </Link>
        ) : (
          <p className="font-semibold leading-snug line-clamp-1">{h.articleTitle}</p>
        )}
        <p className="mt-0.5 text-xs text-[var(--fg-muted)] truncate">
          {[h.authorName, h.topic, h.isAdvancedPaper ? "✦ Advanced Paper" : ""].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {done ? (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--craft-wash)] text-[var(--craft-ink)] font-medium">
              <Check className="w-3 h-3" /> Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--surface)] text-[var(--fg-secondary)] tabular-nums">
              <span className="relative w-8 h-1 rounded-full bg-[var(--border-strong)] overflow-hidden" aria-hidden>
                <span className="absolute inset-y-0 left-0 bg-[var(--gold)]" style={{ width: `${h.progressPercent}%` }} />
              </span>
              {h.progressPercent}% read
            </span>
          )}
          <span className="text-[var(--fg-subtle)]">
            {formatRelativeDate(new Date(h.lastVisitedAt))}
            {h.readCount > 1 && ` · read ${h.readCount}×`}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove “${h.articleTitle}” from history`}
        title="Remove from history"
        className={cn(
          "grid place-items-center w-8 h-8 rounded-full shrink-0 text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-all",
          "sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        )}
      >
        <X className="w-4 h-4" />
      </button>
    </li>
  )
}
