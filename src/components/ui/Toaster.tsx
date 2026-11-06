"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useUIStore } from "@/lib/store"
import { CheckCircle2, AlertCircle, X } from "lucide-react"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Bottom-center stack of short confirmations ("Saved to library", "Link copied")
export function Toaster() {
  const toasts = useUIStore((s) => s.toasts)
  const dismiss = useUIStore((s) => s.dismissToast)

  return (
    <div
      aria-live="polite"
      className="fixed z-[70] bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none w-[min(92vw,420px)]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
            className="pointer-events-auto flex items-center gap-3 w-full pl-4 pr-2 py-2.5 rounded-full bg-[var(--fg)] text-[var(--bg)] shadow-[var(--shadow-lift)] text-sm"
          >
            {t.tone === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-[var(--error)]" />
            ) : (
              <CheckCircle2 className={cn("w-4 h-4 shrink-0", t.tone === "success" ? "text-[#4ade80]" : "opacity-70")} />
            )}
            <span className="flex-1 min-w-0 truncate">{t.message}</span>
            {t.action && (
              <Link
                href={t.action.href}
                onClick={() => dismiss(t.id)}
                className="shrink-0 h-8 px-3 inline-flex items-center rounded-full font-medium bg-[var(--bg)]/15 hover:bg-[var(--bg)]/25 transition-colors"
              >
                {t.action.label}
              </Link>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 grid place-items-center w-8 h-8 rounded-full opacity-60 hover:opacity-100 hover:bg-[var(--bg)]/15 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
