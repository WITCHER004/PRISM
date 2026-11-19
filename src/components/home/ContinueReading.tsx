"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { useContinueReading } from "@/lib/readingProgress"
import { hueStyle, tagFor } from "@/lib/topics"
import { formatRelativeDate } from "@/lib/utils"

/**
 * Stories the signed-in reader left part-way (5–95%), synced across devices from Firestore
 * `reading_progress`. Renders nothing for signed-out readers or when there's nothing to resume.
 */
export function ContinueReading({ className }: { className?: string }) {
  const { items } = useContinueReading(3)

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          aria-labelledby="continue-reading"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
          exit={{ opacity: 0 }}
          className={className}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--panel)] p-2 sm:p-2.5">
              <div className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-2.5">
                <h2 id="continue-reading" className="meta inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" aria-hidden />
                  Continue reading
                </h2>
                <span className="text-xs text-[var(--fg-subtle)]">Synced across your devices</span>
              </div>
              <ul className="grid gap-2 md:grid-cols-3">
                {items.map((p) => (
                  <li key={p.id} style={hueStyle(tagFor(p.topic || "prism").slug)}>
                    <Link
                      href={p.href}
                      className="group flex h-full flex-col gap-2.5 rounded-[14px] bg-[var(--bg)] border border-transparent hover:border-[var(--border-strong)] px-3.5 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-display font-semibold leading-snug line-clamp-1 group-hover:underline underline-offset-4">
                          {p.articleTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--fg-muted)] truncate">
                          {p.authorName}
                          {p.topic ? ` · ${p.topic}` : ""} · {formatRelativeDate(new Date(p.lastReadAt))}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center gap-3">
                        <div
                          className="relative h-1 flex-1 rounded-full bg-[var(--surface)] overflow-hidden"
                          role="progressbar"
                          aria-valuenow={p.progressPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${p.progressPercent}% read`}
                        >
                          <span className="absolute inset-y-0 left-0 rounded-full hue-dot" style={{ width: `${p.progressPercent}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-[var(--fg-muted)] shrink-0">{p.progressPercent}% read</span>
                        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--fg)] shrink-0">
                          Resume <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
