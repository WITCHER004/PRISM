"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface DialogShellProps {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog */
  label: string
  children: React.ReactNode
  className?: string
  /** Block Escape / backdrop / close button (e.g. while a payment is processing) */
  locked?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Modal frame shared by the reading-experience dialogs: backdrop fade, panel fades + scales from 0.96,
// Escape closes, focus moves in on open, is trapped while open, and returns to the trigger on close.
export function DialogShell({ open, onClose, label, children, className, locked }: DialogShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const lockedRef = useRef(locked)
  const closeRef = useRef(onClose)
  useEffect(() => {
    lockedRef.current = locked
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null

    // Focus the first field (or the panel) once the panel has mounted
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const target = panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(target ?? panel).focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        if (!lockedRef.current) closeRef.current()
        return
      }
      if (e.key !== "Tab" || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      returnFocus.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            onClick={() => !locked && onClose()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: dur.fast, ease: ease.in } }}
            className={cn(
              "relative w-full max-w-md panel shadow-[var(--shadow-lift)] p-6 sm:p-7 outline-none max-h-[calc(100dvh-2rem)] overflow-y-auto",
              className
            )}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={locked}
              aria-label="Close"
              className="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
