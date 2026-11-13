"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Editor } from "@tiptap/react"
import {
  ArrowLeft, Check, CircleCheck, Eye, FilePlus2, Gem, Globe, Loader2, Lock, Minus,
  PenLine, Plus, Save, Send, Settings2, X, LayoutGrid, ShieldCheck, Undo2, CircleAlert, ScanSearch,
  Users, Scale, ArrowRight,
} from "lucide-react"
import { useUIStore, toast, type Draft, type PaywallChoice } from "@/lib/store"
import { MOCK_TAGS } from "@/lib/data"
import { Button } from "@/components/ui/Button"
import { Wordmark } from "@/components/ui/Wordmark"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { SignInGate } from "@/components/studio/SignInGate"
import { StoryArticle, topicLabel } from "@/components/studio/StoryArticle"
import { useHydrated } from "@/components/studio/useHydrated"
import { hasBody, useWriter } from "@/components/studio/studio-ui"
import { hueStyle } from "@/lib/topics"
import { dur, ease } from "@/lib/motion"
import { cn, formatRelativeDate } from "@/lib/utils"
import { findAccount } from "@/lib/data"
import type { ArticleStatus, Phase1Report } from "@/lib/moderation/types"
import { AI_MAX_PERCENT, canSubmit, isUnderReview, MIN_WORDS_FOR_SUBMISSION } from "@/lib/moderation/workflow"
import { PANEL_PASS_THRESHOLD, PANEL_SIZE } from "@/lib/elite/config"
import { tallyPanel } from "@/lib/elite/panel"
import { useSubscription } from "@/components/elite/hooks"
import { EliteTag } from "@/components/elite/EliteBadges"
import { requestPhase1 } from "@/lib/moderation/client"
import { AIHumanGauge, Phase1Breakdown, StatusPill } from "@/components/moderation/Phase1Report"
import { PaperSettings } from "@/components/papers/PaperSettings"
import { depthLabel, paperIsComplete, type AdvancedPaper } from "@/lib/papers"
import { clearPromotedIdeaSeed, clearQuoteSeed, readPromotedIdeaSeed, readQuoteSeed } from "@/lib/ideas"

const RichEditor = dynamic(() => import("@/components/editor/RichEditor"), {
  ssr: false,
  loading: () => <div className="h-[50vh] rounded-[var(--radius-card)] bg-[var(--surface)] opacity-40 animate-pulse" aria-hidden />,
})

const PAYWALL_OPTIONS: { value: PaywallChoice; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: "FREE", label: "Free to read", desc: "Anyone can read the whole story.", icon: Globe, tone: "text-[var(--accent)]" },
  { value: "METERED", label: "Member preview", desc: "Non-members read the opening, then a soft gate.", icon: Minus, tone: "text-[var(--warning)]" },
  { value: "SUBSCRIBER", label: "Members only", desc: "Full story for paying members.", icon: Lock, tone: "text-[var(--fg)]" },
  { value: "PAID", label: "Paid story", desc: "A one-time unlock for this story.", icon: Gem, tone: "text-[var(--accent)]" },
]

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)
const toTag = (s: string) => slugify(s).slice(0, 30)
const newId = () => "d_" + Math.random().toString(36).slice(2, 10)

type SaveState = "idle" | "dirty" | "saving" | "saved"

export function StoryEditor({ draftId }: { draftId?: string }) {
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const existing = useUIStore((s) => (draftId ? s.drafts[draftId] : undefined))

  if (!hydrated) return <EditorShell><EditorSkeleton /></EditorShell>
  if (!currentUser)
    return (
      <EditorShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <SignInGate redirectTo={draftId ? `/editor/${draftId}` : "/editor/new"} />
        </div>
      </EditorShell>
    )
  if (draftId && !existing) return <EditorShell><DraftNotFound /></EditorShell>
  return <EditorWorkspace key={draftId ?? "new"} initial={existing} />
}

/* ── Workspace ─────────────────────────────────────────────────────────────── */

function EditorWorkspace({ initial }: { initial?: Draft }) {
  const saveDraft = useUIStore((s) => s.saveDraft)
  const recordPhase1 = useUIStore((s) => s.recordPhase1)
  const withdrawSubmission = useUIStore((s) => s.withdrawSubmission)
  const { user, displayName } = useWriter()

  const [id] = useState(() => initial?.id ?? newId())
  const stored = useUIStore((s) => s.drafts[id])
  // A new story opened from "✦ Turn into Article" starts with pre-filled title & draft content
  const [promotedSeed] = useState(() => (initial ? undefined : readPromotedIdeaSeed()))
  const [title, setTitle] = useState(
    initial?.title ??
      (promotedSeed ? (promotedSeed.text.split("\n")[0].slice(0, 60).replace(/[#*`_]/g, "").trim() || "Promoted Idea") : "")
  )
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "")
  // A new story opened from "Quote in Article" starts with the idea quoted
  const [seedHtml] = useState(() =>
    initial
      ? undefined
      : promotedSeed
        ? `<p>${promotedSeed.text.split("\n").join("</p><p>")}</p><p></p>`
        : readQuoteSeed()
  )
  const [originIdeaMetadata] = useState(() =>
    initial
      ? { originIdeaId: initial.originIdeaId, originIdeaText: initial.originIdeaText, voterIds: initial.voterIds }
      : promotedSeed
        ? { originIdeaId: promotedSeed.ideaId, originIdeaText: promotedSeed.text, voterIds: promotedSeed.voterIds }
        : undefined
  )
  const [html, setHtml] = useState(initial?.contentHtml ?? seedHtml ?? "")
  const [words, setWords] = useState(0)
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [paywall, setPaywall] = useState<PaywallChoice>(initial?.paywall ?? "FREE")
  const [paper, setPaper] = useState<AdvancedPaper | undefined>(initial?.paper)
  const status: ArticleStatus = stored?.status ?? "DRAFT"
  const live = stored?.live
  const isLive = !!live
  const inReview = isUnderReview(status)
  const { isElite } = useSubscription()
  const panelTally = stored?.panel ? tallyPanel(stored.panel) : null
  // Edits to a live story wait for review; readers keep seeing the approved version
  const hasUnsubmittedEdits =
    !!live &&
    (live.title !== title || live.subtitle !== subtitle || live.contentHtml !== html || live.paywall !== paywall || live.tags.join() !== tags.join() || JSON.stringify(live.paper) !== JSON.stringify(paper))

  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : "idle")
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null)
  const [version, setVersion] = useState(0) // bumps on every edit; drives autosave
  const [preview, setPreview] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [publishPhase, setPublishPhase] = useState<null | "confirm" | "checking" | "failed" | "queued">(null)
  const [report, setReport] = useState<Phase1Report | null>(null)
  // While a submission is in review the editor shows the submitted version, read-only
  const showPreview = preview || inReview
  const [, tick] = useState(0)

  const persisted = useRef(!!initial)
  const dirty = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const subtitleRef = useRef<HTMLTextAreaElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])

  const touch = useCallback(() => {
    dirty.current = true
    setSaveState("dirty")
    setVersion((v) => v + 1)
  }, [])

  // Latest values for the save function (used from timers, key handlers and unmount)
  const latest = useRef({ title, subtitle, html, tags, paywall, paper })
  latest.current = { title, subtitle, html, tags, paywall, paper }

  const save = useCallback(
    (opts: { quiet?: boolean; manual?: boolean } = {}) => {
      const v = latest.current
      const empty = !v.title.trim() && !v.subtitle.trim() && !hasBody(v.html)
      if (!persisted.current && empty) {
        if (opts.manual) toast("Nothing to save yet — start with a title")
        dirty.current = false
        setSaveState("idle")
        return null
      }
      const draft = saveDraft({
        id,
        title: v.title,
        subtitle: v.subtitle,
        contentHtml: v.html,
        tags: v.tags,
        paywall: v.paywall,
        paper: v.paper,
        originIdeaId: originIdeaMetadata?.originIdeaId,
        originIdeaText: originIdeaMetadata?.originIdeaText,
        voterIds: originIdeaMetadata?.voterIds,
      })
      if (!persisted.current) {
        persisted.current = true
        // Give the new draft its permanent address without remounting the editor
        window.history.replaceState(window.history.state, "", `/editor/${id}`)
      }
      dirty.current = false
      setSavedAt(draft.updatedAt)
      if (opts.quiet) {
        setSaveState("saved")
      } else {
        setSaveState("saving")
        const t = window.setTimeout(() => setSaveState((s) => (s === "saving" ? "saved" : s)), 450)
        timers.current.push(t)
      }
      return draft
    },
    [id, saveDraft]
  )
  const saveRef = useRef(save)
  saveRef.current = save

  // The quote or promoted idea is in the editor now; clear the session seed
  useEffect(() => {
    if (seedHtml) {
      clearQuoteSeed()
      clearPromotedIdeaSeed()
    }
  }, [seedHtml])

  // Autosave ~1s after the last edit
  useEffect(() => {
    if (!version || !dirty.current) return
    const t = window.setTimeout(() => saveRef.current(), 1000)
    return () => window.clearTimeout(t)
  }, [version])

  // Flush pending edits when leaving inside the app; clear timers
  useEffect(() => {
    const pending = timers.current
    return () => {
      if (dirty.current) saveRef.current({ quiet: true })
      pending.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  // Warn before closing the tab with unsaved edits
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  // Ctrl/Cmd+S saves; Escape closes the settings panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        const d = saveRef.current({ manual: true })
        if (d) toast("Draft saved", { tone: "success" })
      } else if (e.key === "Escape" && settingsOpen && !publishPhase) {
        setSettingsOpen(false)
        settingsBtnRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [settingsOpen, publishPhase])

  // Keep "Saved · 2m ago" fresh
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(t)
  }, [])

  // Size the title/subtitle fields to their content (also after loading a draft or leaving preview)
  useEffect(() => {
    for (const el of [titleRef.current, subtitleRef.current]) {
      if (!el) continue
      el.style.height = "auto"
      el.style.height = el.scrollHeight + "px"
    }
  }, [title, subtitle, preview])

  // Focus the title on a fresh story
  const isNew = useRef(!initial)
  useEffect(() => {
    if (isNew.current) titleRef.current?.focus()
  }, [])

  const onEditorChange = useCallback(
    (nextHtml: string, text: string) => {
      setHtml(nextHtml)
      setWords(text.trim() ? text.trim().split(/\s+/).length : 0)
      touch()
    },
    [touch]
  )
  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor
    const text = editor.getText().trim()
    setWords(text ? text.split(/\s+/).length : 0)
  }, [])

  const addTag = (raw: string) => {
    const t = toTag(raw)
    if (!t) return false
    if (tags.includes(t)) {
      toast(`“${topicLabel(t)}” is already added`)
      return false
    }
    if (tags.length >= 5) {
      toast("Up to 5 topics per story", { tone: "error" })
      return false
    }
    setTags((prev) => [...prev, t])
    touch()
    return true
  }
  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t))
    touch()
  }

  const startPublish = () => {
    if (inReview) return
    if (!title.trim()) {
      toast("Add a title before submitting", { tone: "error" })
      setPreview(false)
      requestAnimationFrame(() => titleRef.current?.focus())
      return
    }
    if (!hasBody(html)) {
      toast("Write a little of your story first", { tone: "error" })
      setPreview(false)
      requestAnimationFrame(() => editorRef.current?.commands.focus("end"))
      return
    }
    if (!paperIsComplete(paper)) {
      toast("Write all three key takeaways for your Advanced Paper", { tone: "error" })
      setSettingsOpen(true)
      return
    }
    if (words < MIN_WORDS_FOR_SUBMISSION) {
      toast(`Articles need at least ${MIN_WORDS_FOR_SUBMISSION} words — you have ${words}`, { tone: "error" })
      return
    }
    if (isLive && !hasUnsubmittedEdits) {
      toast("No changes since the published version")
      return
    }
    setPublishPhase("confirm")
  }

  // Phase 1: save, run the AI-content check, then queue for employee review (or bounce back)
  const confirmPublish = async () => {
    const saved = save({ quiet: true })
    if (!saved || !canSubmit(saved.status)) {
      setPublishPhase(null)
      return
    }
    setPublishPhase("checking")
    const result = await requestPhase1({ title: saved.title, contentHtml: saved.contentHtml })
    if ("error" in result) {
      toast(result.error, { tone: "error" })
      setPublishPhase("confirm")
      return
    }
    const updated = recordPhase1(id, result.report)
    if (!updated) {
      toast(
        result.report.wordCount < MIN_WORDS_FOR_SUBMISSION
          ? `Articles need at least ${MIN_WORDS_FOR_SUBMISSION} words`
          : "This story can't be submitted right now",
        { tone: "error" }
      )
      setPublishPhase(null)
      return
    }
    setReport(result.report)
    setSettingsOpen(false)
    setPublishPhase(result.report.passed ? "queued" : "failed")
  }

  const openLastReport = () => {
    if (!stored?.phase1) return
    setReport(stored.phase1)
    setPublishPhase(stored.phase1.passed ? "queued" : "failed")
  }

  const withdraw = () => {
    withdrawSubmission(id)
    setPreview(false)
    toast("Withdrawn from review — you can edit again")
  }

  const submitLabel = inReview
    ? "In review"
    : status === "PHASE_1_FAILED" || status === "REJECTED"
      ? "Resubmit"
      : isLive
        ? "Submit update"
        : "Submit for review"

  const minutes = Math.max(1, Math.ceil(words / 238))
  const slug = isLive
    ? useUIStore.getState().drafts[id]?.slug ?? `${slugify(title) || "untitled"}-${id.slice(-4)}`
    : `${slugify(title) || "untitled"}-${id.slice(-4)}`
  const statusLabel =
    saveState === "saving"
      ? { key: "saving", text: "Saving…", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> }
      : saveState === "saved"
        ? { key: "saved", text: `Saved · ${savedAt ? formatRelativeDate(savedAt) : "just now"}`, icon: <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> }
        : saveState === "dirty"
          ? { key: "dirty", text: "Unsaved changes", icon: <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" /> }
          : { key: "idle", text: "New draft", icon: <PenLine className="w-3.5 h-3.5" /> }

  const closeSettings = () => {
    setSettingsOpen(false)
    settingsBtnRef.current?.focus()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]" style={hueStyle(tags[0])}>
      {/* Focused header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              href="/dashboard"
              aria-label="Back to Studio"
              className="grid place-items-center w-10 h-10 shrink-0 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="hidden md:inline-flex"><Wordmark size="sm" /></span>
            <span aria-hidden className="hidden md:block h-5 w-px bg-[var(--border)]" />
            {stored && <StatusPill status={status} className="hidden sm:inline-flex" />}
            <div className="relative h-5 min-w-0 overflow-hidden" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={statusLabel.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.in } }}
                  className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] whitespace-nowrap"
                >
                  {statusLabel.icon}
                  {statusLabel.text}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="hidden lg:inline meta mr-2 tabular-nums">
              {words} words · {minutes} min
            </span>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              aria-pressed={preview}
              aria-label={preview ? "Back to editing" : "Preview story"}
              className="inline-flex items-center justify-center gap-1.5 h-10 min-w-10 px-2.5 sm:px-3.5 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              {preview ? <PenLine className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{preview ? "Edit" : "Preview"}</span>
            </button>
            <button
              type="button"
              onClick={() => saveRef.current({ manual: true })}
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
              title="Save (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              ref={settingsBtnRef}
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Story settings"
              aria-expanded={settingsOpen}
              aria-controls="story-settings"
              className={cn(
                "grid place-items-center w-10 h-10 rounded-full transition-colors",
                settingsOpen ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
              )}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <Button variant="accent" className="h-10 px-4 sm:px-5" onClick={startPublish} disabled={inReview}>
              {inReview ? <ShieldCheck className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              <span className="sm:hidden">{inReview ? "In review" : "Submit"}</span>
              <span className="hidden sm:inline">{submitLabel}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative flex-1">
        <main
          className={cn(
            "transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
            settingsOpen && "xl:-translate-x-[180px]"
          )}
        >
          {/* Editing surface stays mounted under preview so undo history and caret survive */}
          <div hidden={showPreview} className="fade-up max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-32">
            <ModerationBanner
              draftId={id}
              panelRejected={!!stored?.panel}
              status={status}
              aiPercent={stored?.phase1?.aiPercent}
              review={stored?.review}
              liveWithEdits={hasUnsubmittedEdits}
              onOpenReport={openLastReport}
            />
            {tags[0] && (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 mb-5 rounded-full hue-wash hue-ink text-sm font-medium capitalize">
                <span className="w-2 h-2 rounded-full hue-dot" />
                {topicLabel(tags[0])}
              </span>
            )}
            <label htmlFor="story-title" className="sr-only">Title</label>
            <textarea
              id="story-title"
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.replace(/\n/g, " "))
                touch()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  subtitleRef.current?.focus()
                }
              }}
              placeholder="Title"
              rows={1}
              maxLength={160}
              className="display block w-full text-[2.5rem] sm:text-[3.75rem] leading-[1] bg-transparent border-none outline-none resize-none placeholder:text-[var(--fg-subtle)] text-[var(--fg)] overflow-hidden"
            />
            <label htmlFor="story-subtitle" className="sr-only">Subtitle</label>
            <textarea
              id="story-subtitle"
              ref={subtitleRef}
              value={subtitle}
              onChange={(e) => {
                setSubtitle(e.target.value.replace(/\n/g, " "))
                touch()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  editorRef.current?.commands.focus("start")
                } else if (e.key === "Backspace" && !subtitle) {
                  e.preventDefault()
                  titleRef.current?.focus()
                }
              }}
              placeholder="Add a subtitle…"
              rows={1}
              maxLength={240}
              className="block w-full mt-4 text-xl sm:text-2xl leading-snug text-[var(--fg-muted)] bg-transparent border-none outline-none resize-none placeholder:text-[var(--fg-subtle)] overflow-hidden"
            />
            <div aria-hidden className="w-16 h-1 rounded-full spectrum-bg mt-8 mb-8" />
            <RichEditor initialContent={initial?.contentHtml ?? seedHtml} onChange={onEditorChange} onReady={onEditorReady} />
            <WordGoal words={words} />
          </div>

          {showPreview && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                className="relative"
              >
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] hue-glow" />
                <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-32">
                  {inReview ? (
                    <div role="status" className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[16px] bg-[var(--panel)] border border-[var(--accent)]/30">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-[var(--accent)]" />
                        <div>
                          <p className="text-sm font-semibold">
                            {status === "PENDING_PEER_PANEL"
                              ? `With the peer panel · ${panelTally ? panelTally.total - panelTally.pending : 0}/${PANEL_SIZE} votes`
                              : status === "COUNTER_SUBMITTED"
                                ? "Counter-reason under reconsideration"
                                : "In employee review"}
                          </p>
                          <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                            {status === "COUNTER_SUBMITTED"
                              ? "Reviewers are reading your defense. You'll be notified when they decide."
                              : `Passed the AI check${stored?.phase1 ? ` (${Math.round(stored.phase1.humanPercent)}% human)` : ""}. ${
                                  status === "PENDING_PEER_PANEL"
                                    ? `It publishes when ${PANEL_PASS_THRESHOLD} of ${PANEL_SIZE} panel members vote PASS.`
                                    : stored?.track === "PEER_PANEL"
                                      ? `A Prism reviewer reads it first; once approved it goes to the ${PANEL_SIZE}-member peer panel.`
                                      : "A Prism reviewer will approve it or send notes."
                                }`}
                            {isLive && " Readers still see the published version."}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        {status !== "PENDING_EMPLOYEE_REVIEW" && (
                          <Link
                            href={`/submissions/${id}`}
                            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
                          >
                            <Scale className="w-4 h-4" /> Scorecard
                          </Link>
                        )}
                        {status !== "COUNTER_SUBMITTED" && (
                          <button
                            type="button"
                            onClick={withdraw}
                            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
                          >
                            <Undo2 className="w-4 h-4" /> Withdraw to edit
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8 flex items-center justify-between gap-3 h-11 pl-4 pr-1.5 rounded-full bg-[var(--panel)] border border-[var(--border)]">
                      <span className="meta">Preview — how readers will see it</span>
                      <button
                        type="button"
                        onClick={() => setPreview(false)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
                      >
                        <PenLine className="w-3.5 h-3.5" /> Keep editing
                      </button>
                    </div>
                  )}
                  <StoryArticle
                    title={title}
                    subtitle={subtitle}
                    html={html}
                    tags={tags}
                    paywall={paywall}
                    paper={paper}
                    postId={id}
                    date={latestDate(savedAt)}
                    author={user}
                    authorName={displayName}
                  />
                </div>
              </motion.div>
          )}
        </main>

        {/* Settings: side panel on desktop, bottom sheet on mobile — both slide with transform */}
        <div
          aria-hidden
          onClick={closeSettings}
          className={cn(
            "lg:hidden fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300",
            settingsOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        />
        <aside
          id="story-settings"
          aria-label="Story settings"
          inert={!settingsOpen}
          className={cn(
            "fixed z-[56] bg-[var(--panel)] border-[var(--border)] shadow-[var(--shadow-lift)] flex flex-col",
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-[24px] border-t",
            "lg:inset-x-auto lg:right-0 lg:top-14 lg:bottom-0 lg:max-h-none lg:w-[360px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none",
            "transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] will-change-transform",
            settingsOpen ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-y-0 lg:translate-x-full"
          )}
        >
          <div aria-hidden className="lg:hidden mx-auto mt-2.5 w-10 h-1 rounded-full bg-[var(--border-strong)]" />
          <div className="flex items-start justify-between gap-3 px-6 pt-5">
            <div>
              <h2 className="display text-[1.5rem]">Story settings</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">How it&apos;s found and who can read it.</p>
            </div>
            <button
              type="button"
              onClick={closeSettings}
              aria-label="Close settings"
              className="grid place-items-center w-10 h-10 -mr-2 shrink-0 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6 space-y-8">
            <section>
              <p className="meta mb-2">Story address</p>
              <p className="px-4 py-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm break-all">
                <span className="text-[var(--fg-muted)]">prism.pub/{user.username}/</span>
                <span className="font-mono text-xs text-[var(--fg)]">{slug}</span>
              </p>
              {isLive && <p className="mt-2 text-xs text-[var(--fg-muted)]">The address stays fixed once a story is published.</p>}
            </section>

            <TopicsField tags={tags} onAdd={addTag} onRemove={removeTag} />

            <fieldset>
              <legend className="meta mb-2">Who can read</legend>
              <div className="space-y-2" role="radiogroup">
                {PAYWALL_OPTIONS.map((opt) => {
                  const active = paywall === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setPaywall(opt.value)
                        touch()
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 p-3.5 rounded-[14px] border text-left transition-colors",
                        active ? "border-[var(--fg)] bg-[var(--bg)]" : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg)]"
                      )}
                    >
                      <span className={cn("mt-0.5 grid place-items-center w-8 h-8 shrink-0 rounded-full bg-[var(--surface)]", opt.tone)}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="block text-xs text-[var(--fg-muted)] mt-0.5">{opt.desc}</span>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1 grid place-items-center w-5 h-5 shrink-0 rounded-full border transition-colors",
                          active ? "bg-[var(--fg)] border-[var(--fg)] text-[var(--bg)]" : "border-[var(--border-strong)] text-transparent"
                        )}
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <PaperSettings
              paper={paper}
              onChange={(next) => {
                setPaper(next)
                touch()
              }}
            />

            <section className="grid grid-cols-2 gap-2">
              <div className="p-3.5 rounded-[14px] bg-[var(--bg)] border border-[var(--border)]">
                <p className="meta">Words</p>
                <p className="mt-1 font-semibold tabular-nums">{words}</p>
              </div>
              <div className="p-3.5 rounded-[14px] bg-[var(--bg)] border border-[var(--border)]">
                <p className="meta">Read time</p>
                <p className="mt-1 font-semibold tabular-nums">{minutes} min</p>
              </div>
            </section>
          </div>

          <div className="border-t border-[var(--border)] p-4 flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => saveRef.current({ manual: true })}>
              <Save className="w-4 h-4" /> Save
            </Button>
            <Button variant="accent" size="lg" className="flex-1" onClick={startPublish} disabled={inReview}>
              {submitLabel}
            </Button>
          </div>
        </aside>
      </div>

      {/* Submit: confirm → Phase 1 check → failed (edit & resubmit) | queued for employee review */}
      <StudioDialog
        open={publishPhase !== null}
        onOpenChange={(o) => !o && publishPhase !== "checking" && setPublishPhase(null)}
        dismissable={publishPhase !== "checking"}
        className={publishPhase === "failed" ? "max-w-xl" : undefined}
        title={
          publishPhase === "checking"
            ? "Checking your story…"
            : publishPhase === "failed"
              ? "Too much reads as AI-generated"
              : publishPhase === "queued"
                ? "Sent to employee review"
                : isLive
                  ? "Submit this update for review?"
                  : "Submit for review?"
        }
        description={
          publishPhase === "checking"
            ? "Phase 1: measuring sentence rhythm, predictability, repetition and phrasing."
            : publishPhase === "failed"
              ? `Prism publishes stories that are at least ${100 - AI_MAX_PERCENT}% human-written. Revise the flagged passages, then resubmit.`
              : publishPhase === "queued"
                ? stored?.track === "PEER_PANEL"
                  ? `Phase 1 passed. A Prism reviewer reads it next; once they approve, ${PANEL_SIZE} peer reviewers vote and it publishes when ${PANEL_PASS_THRESHOLD} vote PASS.`
                  : "Phase 1 passed. A Prism reviewer will read it next, and you'll get a notification when they decide."
                : isElite
                  ? `As an Elite writer your story goes through three checks: an automated AI-content check (at most ${AI_MAX_PERCENT}% AI), a review by a Prism employee, then a vote by a ${PANEL_SIZE}-member peer panel.`
                  : `Every story goes through two checks before it's published: an automated AI-content check (at most ${AI_MAX_PERCENT}% AI), then a review by a Prism employee.`
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {publishPhase === "checking" ? (
            <motion.div key="checking" className="mt-8 mb-2 flex flex-col items-center gap-4 text-center" aria-busy="true">
              <span className="grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)]">
                <ScanSearch className="w-6 h-6 text-[var(--fg-muted)] animate-pulse" />
              </span>
              <p className="text-sm text-[var(--fg-muted)]">This usually takes a second or two.</p>
            </motion.div>
          ) : publishPhase === "failed" && report ? (
            <motion.div
              key="failed"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
              className="mt-6"
            >
              <Phase1Breakdown report={report} />
              <DialogActions>
                <Button variant="accent" size="lg" onClick={() => { setPublishPhase(null); setPreview(false) }}>
                  <PenLine className="w-4 h-4" /> Revise story
                </Button>
              </DialogActions>
            </motion.div>
          ) : publishPhase === "queued" && report ? (
            <motion.div
              key="queued"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.out } }}
            >
              <div className="mt-6 p-4 rounded-[14px] border border-[var(--border)]">
                <AIHumanGauge aiPercent={report.aiPercent} threshold={report.threshold} />
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2.5">
                  <CircleCheck className="w-4 h-4 text-[var(--accent)]" /> Phase 1 · AI-content check passed
                </li>
                <li className="flex items-center gap-2.5 text-[var(--fg-muted)]">
                  <ShieldCheck className="w-4 h-4" /> Phase 2 · Waiting for an employee review
                </li>
                {stored?.track === "PEER_PANEL" && (
                  <li className="flex items-center gap-2.5 text-[var(--fg-muted)]">
                    <Users className="w-4 h-4" /> Phase 3 · {PANEL_SIZE}-member peer panel ({PANEL_PASS_THRESHOLD} PASS votes publish)
                  </li>
                )}
              </ol>
              <DialogActions>
                <Button variant="secondary" size="lg" onClick={() => setPublishPhase(null)}>
                  Close
                </Button>
                <Link
                  href="/profile#tracker"
                  className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" /> Track submissions
                </Link>
              </DialogActions>
            </motion.div>
          ) : (
            <motion.div key="confirm" exit={{ opacity: 0, transition: { duration: dur.fast } }}>
              <dl className="mt-6 divide-y divide-[var(--border)] rounded-[14px] border border-[var(--border)] text-sm">
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">Title</dt>
                  <dd className="font-medium text-right line-clamp-2">{title}</dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">Access</dt>
                  <dd className="font-medium text-right">
                    {paper ? `Advanced Paper · Elite · ${depthLabel(paper.depth)}` : PAYWALL_OPTIONS.find((o) => o.value === paywall)?.label}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">Topics</dt>
                  <dd className="font-medium text-right capitalize">{tags.length ? tags.map(topicLabel).join(", ") : "None"}</dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">Length</dt>
                  <dd className="font-medium tabular-nums">{words} words · {minutes} min read</dd>
                </div>
              </dl>
              <ol className="mt-4 rounded-[14px] border border-[var(--border)] divide-y divide-[var(--border)] text-sm" aria-label="Review steps">
                <li className="flex items-start gap-3 px-4 py-3">
                  <ScanSearch className="w-4 h-4 mt-0.5 shrink-0 text-[var(--fg-muted)]" />
                  <span>
                    <span className="font-medium">1 · AI-content check</span>
                    <span className="block text-xs text-[var(--fg-muted)]">At most {AI_MAX_PERCENT}% AI, checked instantly.</span>
                  </span>
                </li>
                <li className="flex items-start gap-3 px-4 py-3">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--fg-muted)]" />
                  <span>
                    <span className="font-medium">2 · Employee review</span>
                    <span className="block text-xs text-[var(--fg-muted)]">A Prism editor approves it or sends notes.</span>
                  </span>
                </li>
                {isElite ? (
                  <li className="flex items-start gap-3 px-4 py-3">
                    <Users className="w-4 h-4 mt-0.5 shrink-0 text-[var(--fg-muted)]" />
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        3 · {PANEL_SIZE}-member peer panel <EliteTag />
                      </span>
                      <span className="block text-xs text-[var(--fg-muted)]">
                        Specialists vote PASS/FAIL; {PANEL_PASS_THRESHOLD} PASS votes publish it. Earns Peer-Reviewed Scholar.
                      </span>
                    </span>
                  </li>
                ) : (
                  <li className="px-4 py-3 text-xs text-[var(--fg-muted)]">
                    Elite writers also get a {PANEL_SIZE}-member peer panel review.{" "}
                    <Link href="/elite" className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline">
                      See Elite <ArrowRight className="w-3 h-3" />
                    </Link>
                  </li>
                )}
              </ol>
              {isLive && (
                <p className="mt-3 text-xs text-[var(--fg-muted)]">Readers keep seeing the published version until this update is approved.</p>
              )}
              {tags.length === 0 && (
                <p className="mt-3 text-xs text-[var(--fg-muted)]">
                  Tip: adding a topic in{" "}
                  <button type="button" className="underline underline-offset-2 hover:text-[var(--fg)]" onClick={() => { setPublishPhase(null); setSettingsOpen(true) }}>
                    settings
                  </button>{" "}
                  helps readers find it.
                </p>
              )}
              <DialogActions>
                <Button variant="secondary" size="lg" onClick={() => setPublishPhase(null)}>
                  Not yet
                </Button>
                <Button variant="accent" size="lg" onClick={confirmPublish}>
                  <Send className="w-4 h-4" /> Run check &amp; submit
                </Button>
              </DialogActions>
            </motion.div>
          )}
        </AnimatePresence>
      </StudioDialog>
    </div>
  )
}

/* ── Moderation status banner ──────────────────────────────────────────────── */

function ModerationBanner({
  draftId,
  status,
  aiPercent,
  review,
  panelRejected,
  liveWithEdits,
  onOpenReport,
}: {
  draftId: string
  status: ArticleStatus
  aiPercent?: number
  review?: Draft["review"]
  panelRejected: boolean
  liveWithEdits: boolean
  onOpenReport: () => void
}) {
  if (status === "REJECTED" && panelRejected) {
    return (
      <div role="note" className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[16px] border border-[var(--border-strong)] bg-[var(--panel)]">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 mt-0.5 shrink-0 text-[var(--fg-muted)]" />
          <div>
            <p className="text-sm font-semibold">The peer panel didn&apos;t reach consensus</p>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              Read each FAIL reason on your scorecard. You can appeal a vote with a counter-reason, or revise and resubmit.
            </p>
          </div>
        </div>
        <Link
          href={`/submissions/${draftId}`}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
        >
          <Scale className="w-4 h-4" /> Open scorecard
        </Link>
      </div>
    )
  }
  if (status === "PHASE_1_FAILED") {
    return (
      <div role="note" className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[16px] border border-[var(--error)]/30 bg-[var(--panel)]">
        <div className="flex items-start gap-3">
          <CircleAlert className="w-5 h-5 mt-0.5 shrink-0 text-[var(--error)]" />
          <div>
            <p className="text-sm font-semibold">Phase 1 check failed{aiPercent !== undefined ? ` · ${Math.round(aiPercent)}% AI` : ""}</p>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              Stories may be at most {AI_MAX_PERCENT}% AI-generated. Rewrite the flagged passages in your own voice, then resubmit.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenReport}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
        >
          <ScanSearch className="w-4 h-4" /> See report
        </button>
      </div>
    )
  }
  if (status === "REJECTED" && review) {
    const reviewer = findAccount(review.reviewer)
    return (
      <div role="note" className="mb-8 p-4 rounded-[16px] border border-[var(--border-strong)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Needs revision</p>
          <StatusPill status="REJECTED" />
        </div>
        <blockquote className="mt-2 pl-3 border-l-2 border-[var(--border-strong)] text-sm text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line">
          {review.notes}
        </blockquote>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          {reviewer?.displayName ?? "A Prism reviewer"} · {formatRelativeDate(review.at)}. Make the changes and resubmit, or{" "}
          <Link href={`/submissions/${draftId}`} className="underline underline-offset-2 hover:text-[var(--fg)]">
            submit a counter-reason
          </Link>{" "}
          if you think the decision is wrong.
        </p>
      </div>
    )
  }
  if (status === "PUBLISHED" && liveWithEdits) {
    return (
      <div role="note" className="mb-8 flex items-start gap-3 p-4 rounded-[16px] border border-[var(--border)] bg-[var(--panel)]">
        <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-[var(--fg-muted)]" />
        <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
          <span className="font-semibold text-[var(--fg)]">Unsubmitted changes.</span> Readers see the approved version. Submit this
          update to send your edits through review.
        </p>
      </div>
    )
  }
  return null
}

/** Live progress toward the 150-word minimum */
function WordGoal({ words }: { words: number }) {
  const met = words >= MIN_WORDS_FOR_SUBMISSION
  const pct = Math.min(100, (words / MIN_WORDS_FOR_SUBMISSION) * 100)
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-40 bottom-4 left-4 flex items-center gap-3 h-10 pl-3.5 pr-4 rounded-full border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] text-sm"
    >
      <span className="relative w-16 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden" aria-hidden>
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", met ? "bg-emerald-500" : "bg-[var(--fg-subtle)]")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular-nums">
        <span className={cn("font-semibold", met ? "text-emerald-700" : "text-[var(--fg)]")}>{words}</span>
        <span className="text-[var(--fg-muted)]"> / {MIN_WORDS_FOR_SUBMISSION} words</span>
      </span>
      {met ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" aria-label="Minimum reached" />
      ) : (
        <span className="text-xs text-[var(--fg-muted)]">{MIN_WORDS_FOR_SUBMISSION - words} to go</span>
      )}
    </div>
  )
}

function latestDate(savedAt: string | null) {
  return savedAt ?? new Date().toISOString()
}

/* ── Topics ────────────────────────────────────────────────────────────────── */

function TopicsField({ tags, onAdd, onRemove }: { tags: string[]; onAdd: (t: string) => boolean; onRemove: (t: string) => void }) {
  const [value, setValue] = useState("")
  const suggestions = MOCK_TAGS.filter((t) => !tags.includes(t.slug)).slice(0, 6)
  const full = tags.length >= 5

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <label htmlFor="topic-input" className="meta">Topics</label>
        <span className="meta tabular-nums">{tags.length}/5</span>
      </div>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          <AnimatePresence initial={false}>
            {tags.map((t) => (
              <motion.li
                key={t}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, transition: { duration: dur.fast, ease: ease.out } }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: dur.fast * 0.75, ease: ease.in } }}
                style={hueStyle(t)}
                className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full hue-wash hue-ink text-sm font-medium capitalize"
              >
                {topicLabel(t)}
                <button
                  type="button"
                  onClick={() => onRemove(t)}
                  aria-label={`Remove topic ${topicLabel(t)}`}
                  className="grid place-items-center w-6 h-6 rounded-full hover:bg-[var(--panel)] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (onAdd(value)) setValue("")
        }}
      >
        <input
          id="topic-input"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(",", ""))}
          onKeyDown={(e) => {
            if (e.key === ",") {
              e.preventDefault()
              if (onAdd(value)) setValue("")
            }
          }}
          disabled={full}
          placeholder={full ? "Topic limit reached" : "Add a topic"}
          className="flex-1 min-w-0 h-11 px-4 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={full || !value.trim()}
          aria-label="Add topic"
          className="grid place-items-center w-11 h-11 shrink-0 rounded-full border border-[var(--border)] hover:border-[var(--fg)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
      {!full && suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => onAdd(t.slug)}
              style={hueStyle(t.slug)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--border)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-colors"
            >
              <span aria-hidden className="w-1.5 h-1.5 rounded-full hue-dot" />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/* ── States ────────────────────────────────────────────────────────────────── */

function EditorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-4">
          <Link
            href="/dashboard"
            aria-label="Back to Studio"
            className="grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Wordmark size="sm" />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-14" aria-busy="true" aria-label="Loading editor">
      <div className="h-14 w-3/4 rounded-[14px] bg-[var(--surface)] animate-pulse" />
      <div className="mt-5 h-7 w-1/2 rounded-[10px] bg-[var(--surface)] animate-pulse" />
      <div className="mt-12 h-[40vh] rounded-[var(--radius-card)] bg-[var(--surface)] opacity-60 animate-pulse" />
    </div>
  )
}

function DraftNotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
        <FilePlus2 className="w-6 h-6" />
      </span>
      <p className="meta mt-6">Studio</p>
      <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">We can&apos;t find that draft</h1>
      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
        Drafts are saved in the browser they were written in. It may have been deleted, or written somewhere else.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          href="/editor/new"
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
        >
          <PenLine className="w-4 h-4" /> Start a new story
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
        >
          Back to Studio
        </Link>
      </div>
    </div>
  )
}
