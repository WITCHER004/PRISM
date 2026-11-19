"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, X } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import type { ResumeState } from "@/lib/readingProgress"

/** "Resumed at 42% · Jump to top": a quiet pill after restoring the reader's place */
export function ResumeToast({ resumed, onDismiss }: { resumed: ResumeState | null; onDismiss: () => void }) {
  // Steps aside on its own after a while
  useEffect(() => {
    if (!resumed) return
    const t = setTimeout(onDismiss, 9000)
    return () => clearTimeout(t)
  }, [resumed, onDismiss])

  return (
    <AnimatePresence>
      {resumed && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
          exit={{ opacity: 0, y: 16, transition: { duration: dur.fast, ease: ease.in } }}
          className="fixed bottom-24 xl:bottom-6 inset-x-0 z-[45] flex justify-center px-4 pointer-events-none print:hidden"
        >
          <div className="pointer-events-auto inline-flex items-center gap-1 h-10 pl-4 pr-1 rounded-full bg-[#141413] text-[#f4f1ea] border border-white/10 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.45)] text-[13px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" aria-hidden />
            <span>
              Resumed at <span className="tabular-nums font-semibold">{resumed.percent}%</span>
            </span>
            <span className="mx-1.5 text-white/30" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" })
                onDismiss()
              }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full font-medium text-amber-300 hover:bg-white/10 transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" /> Jump to top
            </button>
            <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid place-items-center w-8 h-8 rounded-full hover:bg-white/10">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
