"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogProps {
  open: boolean
  onClose: () => void
  /** id of the element that names the dialog */
  labelledBy: string
  /** When false (e.g. while a payment is processing) Escape, the backdrop and the close button do nothing */
  dismissible?: boolean
  className?: string
  children: React.ReactNode
}

// Modal dialog: portals to <body>, traps Tab inside, closes on Escape / backdrop,
// and gives focus back to whatever opened it.
export function Dialog({ open, onClose, labelledBy, dismissible = true, className, children }: DialogProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogInner onClose={onClose} labelledBy={labelledBy} dismissible={dismissible} className={className}>
          {children}
        </DialogInner>
      )}
    </AnimatePresence>,
    document.body
  )
}

function DialogInner({ onClose, labelledBy, dismissible, className, children }: Omit<DialogProps, "open">) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const dismissRef = useRef(dismissible)
  useEffect(() => {
    closeRef.current = onClose
    dismissRef.current = dismissible
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus({ preventScroll: true })

    // Lock page scroll without the layout jumping when the scrollbar disappears
    const { body } = document
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = "hidden"
    if (gap > 0) body.style.paddingRight = `${gap}px`

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        if (dismissRef.current) closeRef.current()
        return
      }
      if (e.key !== "Tab" || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return e.preventDefault()
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === firstEl || !panelRef.current.contains(active))) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (active === lastEl || !panelRef.current.contains(active))) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener("keydown", onKey, true)

    return () => {
      document.removeEventListener("keydown", onKey, true)
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[var(--fg)]/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
        exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
        onClick={() => dismissible && onClose()}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.soft }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
        className={cn(
          "relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto panel shadow-[var(--shadow-lift)] p-6 sm:p-7 outline-none",
          className
        )}
      >
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {children}
      </motion.div>
    </div>
  )
}
