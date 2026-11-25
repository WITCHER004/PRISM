"use client"

import { usePaywallBody } from "@/components/posts/paywallAccess"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Download, FileCode2, FileText, Lock, Printer, ScrollText } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { toast, useUIStore } from "@/lib/store"
import { useViewer } from "@/components/providers/useViewer"
import { useAccess } from "@/components/providers/useAccess"
import { usePostUnlocked } from "@/components/posts/PaywallContent"
import { fetchMyHighlights } from "@/lib/highlights"
import { downloadFile, fileSlug, printEdition, toMarkdown, toPlainText, toReaderHtml, type ExportMeta } from "@/lib/exporters"

interface ExportMenuProps {
  postId: string
  html: string
  meta: Omit<ExportMeta, "url"> & { path: string }
  isAdvancedPaper: boolean
  /** Paywalled (members-only, metered…) stories export only once unlocked */
  paywalled?: boolean
  className?: string
}

const FORMATS = [
  { id: "pdf", label: "Print-ready PDF", hint: ".pdf · via print", icon: Printer },
  { id: "md", label: "Markdown", hint: ".md · with your highlights", icon: FileCode2 },
  { id: "txt", label: "Plain text", hint: ".txt · manuscript", icon: FileText },
  { id: "html", label: "Offline HTML reader", hint: ".html · light & dark", icon: ScrollText },
] as const
type Format = (typeof FORMATS)[number]["id"]

/** "↓ Export" pill: Markdown, plain text, offline HTML and a print edition, all generated in the browser */
export function ExportMenu({ postId, html: pageHtml, meta, isAdvancedPaper, paywalled = false, className }: ExportMenuProps) {
  // Locked stories reach the page as a preview; export the full text once the server has granted it
  const html = usePaywallBody(postId) ?? pageHtml
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const uid = useUIStore((s) => s.authUid)
  const currentUser = useUIStore((s) => s.currentUser)
  const { isElite: viewerElite } = useViewer()
  const access = useAccess()
  const unlocked = usePostUnlocked(postId, paywalled || isAdvancedPaper)

  const isAuthor = !!currentUser && currentUser === meta.authorHandle
  const isElite = viewerElite || access.isElite
  const eliteLocked = isAdvancedPaper && !isElite && !isAuthor
  const locked = eliteLocked || (!isAuthor && !unlocked)
  const lockLabel = eliteLocked ? "Elite Exclusive — upgrade to export Advanced Papers" : "Unlock this story to export it"

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const run = async (format: Format) => {
    setOpen(false)
    if (locked) return
    const full: ExportMeta = { ...meta, url: `${window.location.origin}${meta.path}` }
    const name = fileSlug(meta.title)
    try {
      setBusy(true)
      if (format === "pdf") printEdition(full, html)
      else if (format === "md") {
        const highlights = uid ? await fetchMyHighlights(uid, postId) : []
        downloadFile(`${name}.md`, toMarkdown(full, html, highlights), "text/markdown")
        toast(highlights.length ? `Exported with ${highlights.length} highlight${highlights.length === 1 ? "" : "s"}` : "Markdown downloaded", { tone: "success" })
      } else if (format === "txt") downloadFile(`${name}.txt`, toPlainText(full, html), "text/plain")
      else downloadFile(`${name}.html`, toReaderHtml(full, html), "text/html")
    } catch (err) {
      console.warn("[export] failed:", err)
      toast("Couldn't export this story.", { tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className={cn("relative print:hidden", className)}>
      <button
        type="button"
        onClick={() => (locked ? toast(lockLabel) : setOpen((o) => !o))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-disabled={locked}
        title={locked ? (eliteLocked ? "Elite Exclusive" : "Locked") : "Export this story"}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border transition-colors",
          locked
            ? "border-[var(--border)] text-[var(--fg-subtle)] cursor-not-allowed"
            : "border-[var(--border)] bg-[var(--panel)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        )}
      >
        {locked ? <Lock className="w-3.5 h-3.5" /> : <Download className={cn("w-3.5 h-3.5", busy && "animate-bounce")} />}
        Export
        {eliteLocked && <span className="ml-0.5 text-[10px] text-[var(--gold)]">✦ Elite</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Export formats"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.fast * 1.4, ease: ease.out } }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
            className="absolute left-0 top-full mt-2 z-40 w-64 p-1.5 origin-top-left rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl"
          >
            <p className="px-2.5 pt-1.5 pb-2 meta">Export this story</p>
            {FORMATS.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => run(id)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[10px] text-left hover:bg-[var(--surface)] transition-colors"
              >
                <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--surface)] text-[var(--fg-secondary)]">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-[var(--fg)]">{label}</span>
                  <span className="block text-xs text-[var(--fg-muted)]">{hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
