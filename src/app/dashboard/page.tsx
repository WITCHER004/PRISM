"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Eye, FileText, Hand, Pencil, PenLine, Trash2, Users, ExternalLink } from "lucide-react"
import { useUIStore, toast, type Draft } from "@/lib/store"
import { Button } from "@/components/ui/Button"
import { Reveal } from "@/components/motion/Reveal"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { useHydrated } from "@/components/studio/useHydrated"
import {
  PageHead,
  SampleBadge,
  StatTile,
  samplePostsFor,
  useWriter,
  wordCount,
  htmlToText,
} from "@/components/studio/studio-ui"
import { hueStyle } from "@/lib/topics"
import { dur, ease, spring } from "@/lib/motion"
import { cn, formatRelativeDate, numberWithCommas } from "@/lib/utils"

type Tab = "all" | "drafts" | "published"

interface Row {
  key: string
  kind: "local" | "sample"
  title: string
  excerpt: string
  status: "draft" | "published"
  date: string
  minutes: number
  topic?: string
  viewHref: string
  draft?: Draft
  views?: number
  claps?: number
}

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "drafts", label: "Drafts" },
  { value: "published", label: "Published" },
]

export default function StudioOverviewPage() {
  const hydrated = useHydrated()
  const drafts = useUIStore((s) => s.drafts)
  const deleteDraft = useUIStore((s) => s.deleteDraft)
  const { user, displayName } = useWriter()
  const [tab, setTab] = useState<Tab>("all")
  const [pendingDelete, setPendingDelete] = useState<Draft | null>(null)
  const deletedRef = useRef(false)
  const tablistRef = useRef<HTMLDivElement>(null)

  const samples = useMemo(() => samplePostsFor(user.username), [user.username])
  const localDrafts = useMemo(
    () => Object.values(drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts]
  )

  const rows: Row[] = useMemo(() => {
    const local: Row[] = localDrafts.map((d) => ({
      key: d.id,
      kind: "local",
      title: d.title.trim() || "Untitled story",
      excerpt: d.subtitle || htmlToText(d.contentHtml).slice(0, 140),
      status: d.status,
      date: d.updatedAt,
      minutes: Math.max(1, Math.ceil(wordCount(d.contentHtml) / 238)),
      topic: d.tags[0],
      viewHref: `/story/${d.id}`,
      draft: d,
    }))
    const sample: Row[] = samples.map((p) => ({
      key: p.id,
      kind: "sample",
      title: p.title,
      excerpt: p.subtitle ?? p.excerpt,
      status: "published",
      date: p.publishedAt,
      minutes: p.readingTimeMin,
      topic: p.tags[0]?.slug,
      viewHref: `/${p.author.username}/${p.slug}`,
      views: p.viewCount,
      claps: p.clapCount,
    }))
    return [...local, ...sample]
  }, [localDrafts, samples])

  const counts = {
    all: rows.length,
    drafts: rows.filter((r) => r.status === "draft").length,
    published: rows.filter((r) => r.status === "published").length,
  }
  const visible = rows.filter((r) => tab === "all" || (tab === "drafts" ? r.status === "draft" : r.status === "published"))

  const localPublished = localDrafts.filter((d) => d.status === "published").length
  const localDraftCount = localDrafts.length - localPublished
  const sampleViews = samples.reduce((a, p) => a + p.viewCount, 0)
  const sampleClaps = samples.reduce((a, p) => a + p.clapCount, 0)

  const confirmDelete = () => {
    if (!pendingDelete) return
    deletedRef.current = true
    deleteDraft(pendingDelete.id)
    toast(`Deleted “${pendingDelete.title.trim() || "Untitled story"}”`)
    setPendingDelete(null)
  }

  const firstName = displayName.split(" ")[0]

  return (
    <>
      <PageHead
        title={<>Welcome back, {firstName}.</>}
        lede="Everything you've written, how it's landing, and what's next."
        actions={
          <Link
            href="/editor/new"
            className="sm:hidden inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-medium bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            <PenLine className="w-4 h-4" />
            Write a story
          </Link>
        }
      />

      {/* Stats */}
      <section aria-label="Overview" className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile label="Stories" icon={FileText} value={samples.length + localPublished}
          sub={hydrated ? <span>{localDraftCount} draft{localDraftCount === 1 ? "" : "s"} · {localPublished} published here</span> : <span>Loading your drafts…</span>} />
        <StatTile label="Total views" icon={Eye} value={numberWithCommas(sampleViews)} sub={<span>+12% this month</span>} sample />
        <StatTile label="Followers" icon={Users} value={numberWithCommas(user.followerCount)} sub={<span>+340 this month</span>} sample />
        <StatTile label="Claps" icon={Hand} value={numberWithCommas(sampleClaps)} sub={<span>+8% this month</span>} sample />
      </section>

      {/* Stories */}
      <Reveal as="section" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-[1.75rem]">Your stories</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Drafts autosave in this browser. Sample stories link to their live pages.
            </p>
          </div>
          <div ref={tablistRef} role="tablist" aria-label="Filter stories" className="flex items-center gap-1 border-b border-[var(--border)]">
            {TABS.map((t) => {
              const active = tab === t.value
              return (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "relative h-11 px-4 text-sm font-medium transition-colors",
                    active ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  )}
                >
                  {t.label}
                  <span className="ml-1.5 meta tabular-nums">{counts[t.value]}</span>
                  {active && (
                    <motion.span
                      layoutId="stories-tab-underline"
                      className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-[var(--fg)]"
                      transition={spring.snappy}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 panel overflow-hidden" role="tabpanel">
          {!hydrated && visible.length === 0 ? (
            <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading stories">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-[14px] bg-[var(--surface)] animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((row) => (
                  <motion.li
                    key={row.key}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                    exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
                    className="bg-[var(--panel)]"
                  >
                    <StoryRow row={row} onDelete={() => row.draft && setPendingDelete(row.draft)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </Reveal>

      <StudioDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this story?"
        onCloseAutoFocus={(e) => {
          // The row that opened the dialog is gone; land on the active filter tab instead
          if (!deletedRef.current) return
          deletedRef.current = false
          e.preventDefault()
          tablistRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
        }}
        description={
          <>
            “{pendingDelete?.title.trim() || "Untitled story"}” will be removed from this browser
            {pendingDelete?.status === "published" ? " and its story page will stop working" : ""}. This can&apos;t be undone.
          </>
        }
      >
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button variant="destructive" size="lg" onClick={confirmDelete}>
            <Trash2 className="w-4 h-4" />
            Delete story
          </Button>
        </DialogActions>
      </StudioDialog>
    </>
  )
}

function StoryRow({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const action =
    "inline-flex items-center justify-center gap-1.5 h-10 min-w-10 px-3 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 sm:p-5" style={hueStyle(row.topic)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {row.status === "published" ? (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-medium">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[var(--warning-subtle)] text-[var(--warning)] text-xs font-medium">
              <Pencil className="w-3 h-3" aria-hidden />
              Draft
            </span>
          )}
          {row.kind === "sample" && <SampleBadge label="Sample" />}
          {row.topic && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full hue-wash hue-ink text-xs font-medium capitalize">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full hue-dot" />
              {row.topic.replace(/-/g, " ")}
            </span>
          )}
        </div>
        <Link
          href={row.kind === "local" ? `/editor/${row.key}` : row.viewHref}
          className="mt-2 block font-semibold text-[1.05rem] leading-snug line-clamp-1 hover:underline underline-offset-2"
        >
          {row.title}
        </Link>
        {row.excerpt && <p className="mt-1 text-sm text-[var(--fg-muted)] line-clamp-1">{row.excerpt}</p>}
        <p className="meta mt-2">
          {row.kind === "local" ? "Edited " : ""}
          {formatRelativeDate(row.date)} · {row.minutes} min read
          {row.views !== undefined && <> · {numberWithCommas(row.views)} views · {numberWithCommas(row.claps ?? 0)} claps</>}
        </p>
      </div>

      <div className="flex items-center gap-1 -ml-3 sm:ml-0 shrink-0">
        {row.kind === "local" ? (
          <>
            <Link href={`/editor/${row.key}`} className={action}>
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <Link href={row.viewHref} className={action}>
              <Eye className="w-4 h-4" />
              {row.status === "published" ? "View" : "Preview"}
            </Link>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete “${row.title}”`}
              className={cn(action, "px-0 w-10 hover:text-[var(--error)]")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <Link href={row.viewHref} className={action}>
            <ExternalLink className="w-4 h-4" />
            View
          </Link>
        )}
      </div>
    </div>
  )
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy =
    tab === "drafts"
      ? { title: "No drafts in progress", body: "Start something new — it autosaves as you type." }
      : tab === "published"
        ? { title: "Nothing published yet", body: "Finish a draft and hit Publish to see it here." }
        : { title: "Your desk is clear", body: "Every great story starts with a blank page." }
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
        <FileText className="w-5 h-5" />
      </span>
      <p className="mt-4 font-semibold">{copy.title}</p>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{copy.body}</p>
      <Link
        href="/editor/new"
        className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
      >
        <PenLine className="w-4 h-4" />
        Write a story
      </Link>
    </div>
  )
}
