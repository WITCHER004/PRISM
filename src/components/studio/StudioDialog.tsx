"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface StudioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  /** Hide the close (X) button, e.g. while something is processing */
  dismissable?: boolean
  className?: string
  /** Where focus goes on close when the opener no longer exists (e.g. a deleted row) */
  onCloseAutoFocus?: (e: Event) => void
}

// Centered modal: backdrop fades, card fades + scales up from 0.96. Radix handles
// Escape, focus trapping, and returning focus to whatever opened it.
export function StudioDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  dismissable = true,
  className,
  onCloseAutoFocus,
}: StudioDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (dismissable || o ? onOpenChange(o) : undefined)}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
                exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-[81] grid place-items-center p-4 pointer-events-none">
              <Dialog.Content asChild forceMount onCloseAutoFocus={onCloseAutoFocus}>
                <motion.div
                  className={cn(
                    "pointer-events-auto relative w-full max-w-md panel shadow-[var(--shadow-lift)] p-6 sm:p-7 max-h-[calc(100vh-2rem)] overflow-y-auto focus:outline-none",
                    className
                  )}
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
                >
                  <Dialog.Title className="display text-[1.6rem] pr-10">{title}</Dialog.Title>
                  {description ? (
                    <Dialog.Description className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">
                      {description}
                    </Dialog.Description>
                  ) : (
                    <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Dialog.Description>
                  )}
                  {children}
                  {dismissable && (
                    <Dialog.Close
                      aria-label="Close"
                      className="absolute top-4 right-4 grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </Dialog.Close>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** Right-aligned row of dialog buttons */
export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{children}</div>
}
