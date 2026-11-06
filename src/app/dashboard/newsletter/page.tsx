"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleCheck, Download, Loader2, Mail, MailOpen, MousePointerClick, Search, Send, Upload, UserPlus, Users } from "lucide-react"
import { useUIStore, toast } from "@/lib/store"
import { Button } from "@/components/ui/Button"
import { Reveal } from "@/components/motion/Reveal"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { PageHead, SampleBadge, StatTile, inputClass, samplePostsFor, useWriter } from "@/components/studio/studio-ui"
import { dur, ease } from "@/lib/motion"
import { cn, numberWithCommas } from "@/lib/utils"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SAMPLE_COUNT = 14290
const SAMPLE_SUBSCRIBERS = [
  "maya.okafor@hey.com",
  "dev.patel@fastmail.com",
  "j.lindqvist@proton.me",
  "hello@ritasato.dev",
  "tom.becker@gmail.com",
  "ana.ruiz@outlook.com",
  "k.mensah@icloud.com",
  "sam@builders.club",
]

interface Issue {
  id: string
  subject: string
  sentAt: string
  recipients: number
  openRate: number | null
}

const SAMPLE_ISSUES: Issue[] = [
  { id: "i3", subject: "Issue #41 — Sagas, not two-phase commit", sentAt: "Oct 24", recipients: 14102, openRate: 56.2 },
  { id: "i2", subject: "Issue #40 — The cost of being eventually right", sentAt: "Oct 10", recipients: 13870, openRate: 53.9 },
  { id: "i1", subject: "Issue #39 — Software that lasts 20 years", sentAt: "Sep 26", recipients: 13544, openRate: 55.1 },
]

export default function NewsletterPage() {
  const subscribers = useUIStore((s) => s.newsletterSubscribers)
  const addSubscriber = useUIStore((s) => s.addSubscriber)
  const drafts = useUIStore((s) => s.drafts)
  const { user, displayName } = useWriter()

  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [query, setQuery] = useState("")
  const [showAll, setShowAll] = useState(false)
  const [issues, setIssues] = useState<Issue[]>(SAMPLE_ISSUES)
  const fileRef = useRef<HTMLInputElement>(null)

  // Compose
  const [composeOpen, setComposeOpen] = useState(false)
  const [phase, setPhase] = useState<"edit" | "sending" | "sent">("edit")
  const [subject, setSubject] = useState("")
  const [storyKey, setStoryKey] = useState("")
  const [note, setNote] = useState("")
  const [testing, setTesting] = useState(false)
  const [composeError, setComposeError] = useState("")
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const stories = useMemo(() => {
    const local = Object.values(drafts)
      .filter((d) => d.status === "published")
      .map((d) => ({ key: `local:${d.id}`, title: d.title }))
    const sample = samplePostsFor(user.username).map((p) => ({ key: `sample:${p.id}`, title: p.title }))
    return [...local, ...sample]
  }, [drafts, user.username])

  const total = SAMPLE_COUNT + subscribers.length
  const everyone = useMemo(
    () => [
      ...[...subscribers].reverse().map((e) => ({ email: e, sample: false })),
      ...SAMPLE_SUBSCRIBERS.map((e) => ({ email: e, sample: true })),
    ],
    [subscribers]
  )
  const filtered = everyone.filter((s) => s.email.includes(query.trim().toLowerCase()))
  const shown = showAll ? filtered : filtered.slice(0, 8)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const v = email.trim().toLowerCase()
    if (!EMAIL_RE.test(v)) {
      setEmailError("Enter a valid email, like name@example.com")
      return
    }
    if (subscribers.includes(v) || SAMPLE_SUBSCRIBERS.includes(v)) {
      setEmailError("That address is already subscribed")
      return
    }
    if (addSubscriber(v)) {
      toast(`Added ${v}`, { tone: "success" })
      setEmail("")
      setEmailError("")
    }
  }

  const importCsv = async (file: File) => {
    const text = await file.text()
    const found = Array.from(new Set((text.match(/[^\s,;"'<>]+@[^\s,;"'<>]+\.[^\s,;"'<>]+/g) ?? []).map((x) => x.toLowerCase())))
    if (found.length === 0) {
      toast("No email addresses found in that file", { tone: "error" })
      return
    }
    let added = 0
    for (const e of found) if (!SAMPLE_SUBSCRIBERS.includes(e) && addSubscriber(e)) added++
    const skipped = found.length - added
    toast(
      added
        ? `Imported ${added} subscriber${added === 1 ? "" : "s"}${skipped ? ` · ${skipped} already on the list` : ""}`
        : `All ${found.length} addresses were already subscribed`,
      { tone: added ? "success" : "default" }
    )
  }

  const exportList = () => {
    const rows = ["email,source", ...everyone.map((s) => `${s.email},${s.sample ? "sample" : "added"}`)]
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "prism-subscribers.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast(`Exported ${everyone.length} subscribers`, { tone: "success" })
  }

  const openCompose = () => {
    setPhase("edit")
    setComposeError("")
    if (!storyKey && stories[0]) {
      setStoryKey(stories[0].key)
      if (!subject) setSubject(`Issue #${42 + issues.length - SAMPLE_ISSUES.length} — ${stories[0].title}`)
    }
    setComposeOpen(true)
  }

  const sendTest = () => {
    if (!subject.trim()) return setComposeError("Add a subject line first")
    setTesting(true)
    timers.current.push(
      window.setTimeout(() => {
        setTesting(false)
        toast(`Test sent to ${user.username}@prism.pub`, { tone: "success" })
      }, 900)
    )
  }

  const send = () => {
    if (!subject.trim()) return setComposeError("Add a subject line first")
    setPhase("sending")
    timers.current.push(
      window.setTimeout(() => {
        setIssues((list) => [
          { id: "i" + Date.now(), subject: subject.trim(), sentAt: "Just now", recipients: total, openRate: null },
          ...list,
        ])
        setPhase("sent")
        toast(`Sent to ${total.toLocaleString("en-US")} subscribers`, { tone: "success" })
      }, 1800)
    )
  }

  const closeCompose = (o: boolean) => {
    if (o || phase === "sending") return
    setComposeOpen(false)
    if (phase === "sent") {
      setSubject("")
      setNote("")
      setStoryKey("")
    }
  }

  return (
    <>
      <PageHead
        title="Newsletter"
        lede="Send stories straight to your readers' inboxes — no third-party email tool needed."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importCsv(f)
                e.target.value = ""
              }}
            />
            <Button variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Import CSV
            </Button>
            <Button variant="secondary" size="lg" onClick={exportList}>
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button variant="accent" size="lg" onClick={openCompose}>
              <Send className="w-4 h-4" /> Compose issue
            </Button>
          </>
        }
      />

      <section aria-label="Audience" className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatTile
          label="Subscribers"
          icon={Users}
          value={total.toLocaleString("en-US")}
          sub={<span>{subscribers.length ? `+${subscribers.length} added here` : "Includes sample list"}</span>}
          sample
        />
        <StatTile label="Avg. open rate" icon={MailOpen} value="54.8%" sub={<span>Industry avg. 21%</span>} sample />
        <StatTile label="Click-through" icon={MousePointerClick} value="18.2%" sub={<span>Last 3 issues</span>} sample />
      </section>

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        {/* Subscribers */}
        <Reveal as="section" className="lg:col-span-3 panel p-5 sm:p-7">
          <h2 className="display text-[1.5rem]">Subscribers</h2>
          <form onSubmit={add} noValidate className="mt-5">
            <label htmlFor="add-subscriber" className="text-sm font-medium">Add a subscriber</label>
            <div className="mt-2 flex gap-2">
              <input
                id="add-subscriber"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError("")
                }}
                placeholder="name@example.com"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "add-subscriber-err" : undefined}
                className={cn(inputClass, "flex-1 min-w-0", emailError && "border-[var(--error)]")}
              />
              <Button type="submit" variant="primary" size="lg" className="shrink-0">
                <UserPlus className="w-4 h-4" /> Add
              </Button>
            </div>
            <AnimatePresence>
              {emailError && (
                <motion.p
                  id="add-subscriber-err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.fast } }}
                  exit={{ opacity: 0, transition: { duration: dur.fast } }}
                  className="mt-2 text-xs text-[var(--error)]"
                >
                  {emailError}
                </motion.p>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-6 relative">
            <label htmlFor="sub-search" className="sr-only">Search subscribers</label>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-subtle)]" aria-hidden />
            <input
              id="sub-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subscribers"
              className={cn(inputClass, "pl-10 bg-[var(--bg)]")}
            />
          </div>

          <ul className="mt-3 divide-y divide-[var(--border)]">
            <AnimatePresence initial={false}>
              {shown.map((s) => (
                <motion.li
                  key={s.email}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                  exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span aria-hidden className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-[var(--surface)] text-xs font-semibold uppercase text-[var(--fg-muted)]">
                      {s.email[0]}
                    </span>
                    <span className="text-sm truncate">{s.email}</span>
                  </span>
                  {s.sample ? (
                    <SampleBadge label="Sample" />
                  ) : (
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-medium">Added here</span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No subscribers match “{query}”.</p>
          )}
          {filtered.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 h-10 px-4 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              {showAll ? "Show fewer" : `Show all ${filtered.length}`}
            </button>
          )}
          <p className="mt-4 meta normal-case tracking-normal">
            Showing the addresses in this browser plus a few sample readers — the other {numberWithCommas(SAMPLE_COUNT - SAMPLE_SUBSCRIBERS.length)} are sample data.
          </p>
        </Reveal>

        {/* Issues */}
        <Reveal as="section" index={1} className="lg:col-span-2 panel p-5 sm:p-7">
          <h2 className="display text-[1.5rem]">Recent issues</h2>
          <ul className="mt-5 space-y-3">
            <AnimatePresence initial={false}>
              {issues.map((i) => (
                <motion.li
                  key={i.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                  className="p-4 rounded-[14px] bg-[var(--bg)] border border-[var(--border)]"
                >
                  <p className="text-sm font-medium line-clamp-2">{i.subject}</p>
                  <p className="meta mt-2">
                    {i.sentAt} · {i.recipients.toLocaleString("en-US")} sent · {i.openRate === null ? "opens arriving" : `${i.openRate}% opened`}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Button variant="outline" size="lg" className="mt-5 w-full" onClick={openCompose}>
            <Mail className="w-4 h-4" /> Write a new issue
          </Button>
        </Reveal>
      </div>

      {/* Compose */}
      <StudioDialog
        open={composeOpen}
        onOpenChange={closeCompose}
        dismissable={phase !== "sending"}
        className="max-w-lg"
        title={phase === "sent" ? "Issue sent" : phase === "sending" ? "Sending…" : "Compose issue"}
        description={
          phase === "sent"
            ? "Simulated in demo mode — opens and clicks will appear under Recent issues."
            : phase === "sending"
              ? `Delivering to ${total.toLocaleString("en-US")} inboxes.`
              : `From ${displayName} · ${user.username}@prism.pub`
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {phase === "edit" && (
            <motion.div key="edit" exit={{ opacity: 0, transition: { duration: dur.fast } }} className="mt-6 space-y-4">
              <div>
                <label htmlFor="nl-subject" className="text-sm font-medium">Subject line</label>
                <input
                  id="nl-subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    setComposeError("")
                  }}
                  placeholder="Issue #42 — …"
                  aria-invalid={!!composeError}
                  className={cn(inputClass, "mt-2 bg-[var(--bg)]", composeError && "border-[var(--error)]")}
                />
                {composeError && <p className="mt-2 text-xs text-[var(--error)]">{composeError}</p>}
              </div>
              <div>
                <label htmlFor="nl-story" className="text-sm font-medium">Featured story</label>
                <select
                  id="nl-story"
                  value={storyKey}
                  onChange={(e) => setStoryKey(e.target.value)}
                  className={cn(inputClass, "mt-2 bg-[var(--bg)] appearance-none cursor-pointer")}
                >
                  <option value="">No featured story</option>
                  {stories.map((s) => (
                    <option key={s.key} value={s.key}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="nl-note" className="text-sm font-medium">A note to readers <span className="text-[var(--fg-muted)] font-normal">(optional)</span></label>
                <textarea
                  id="nl-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="What's this issue about?"
                  className="mt-2 w-full px-4 py-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--fg)] outline-none resize-none placeholder:text-[var(--fg-subtle)]"
                />
              </div>
              <DialogActions>
                <Button variant="secondary" size="lg" onClick={sendTest} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {testing ? "Sending test…" : "Send test"}
                </Button>
                <Button variant="accent" size="lg" onClick={send}>
                  <Send className="w-4 h-4" /> Send to {numberWithCommas(total)}
                </Button>
              </DialogActions>
            </motion.div>
          )}
          {phase === "sending" && (
            <motion.div
              key="sending"
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.base } }}
              exit={{ opacity: 0, transition: { duration: dur.fast } }}
              className="mt-8 mb-2 flex flex-col items-center gap-4"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
              <div className="w-full h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                <motion.div
                  className="h-full w-full bg-[var(--accent)] origin-left rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.7, ease: ease.out }}
                />
              </div>
            </motion.div>
          )}
          {phase === "sent" && (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.out } }}>
              <div className="mt-6 flex items-center gap-3 p-4 rounded-[14px] bg-[var(--accent-subtle)]">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 22 } }}
                  className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
                >
                  <CircleCheck className="w-5 h-5" />
                </motion.span>
                <p className="text-sm font-medium line-clamp-2">{subject}</p>
              </div>
              <DialogActions>
                <Button variant="primary" size="lg" onClick={() => closeCompose(false)}>Done</Button>
              </DialogActions>
            </motion.div>
          )}
        </AnimatePresence>
      </StudioDialog>
    </>
  )
}
