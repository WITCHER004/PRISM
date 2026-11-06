"use client"

import Link from "next/link"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Bell, UserPlus, MessageCircle, Sparkles, CheckCheck } from "lucide-react"
import { useUIStore } from "@/lib/store"
import { formatRelativeDate, cn } from "@/lib/utils"
import { dur, ease } from "@/lib/motion"

const ICONS = { follow: UserPlus, comment: MessageCircle, clap: Sparkles, system: Bell } as const

// Bell with unread dot; opens a panel listing activity. Reading an item marks it read.
export function NotificationsMenu({ buttonClassName }: { buttonClassName: string }) {
  const [open, setOpen] = useState(false)
  const { notifications, markAllRead, markRead } = useUIStore()
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn(buttonClassName, "relative")}
      >
        <Bell className="w-[18px] h-[18px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-2 right-2.5 w-2 h-2 rounded-full spectrum-bg ring-2 ring-[var(--panel)]"
            />
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-label="Notifications"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.fast * 1.4, ease: ease.out } }}
              exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: dur.fast, ease: ease.in } }}
              className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-20 sm:top-full sm:mt-3 sm:w-[360px] origin-top-right panel shadow-[var(--shadow-lift)] z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h2 className="font-display font-semibold text-base tracking-tight">Notifications</h2>
                <button
                  onClick={markAllRead}
                  disabled={!unread}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto p-1.5 pt-0">
                {notifications.map((n) => {
                  const Icon = ICONS[n.kind]
                  const body = (
                    <>
                      <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-[var(--surface)] text-[var(--fg-secondary)]">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={cn("block text-sm leading-snug", !n.read ? "text-[var(--fg)] font-medium" : "text-[var(--fg-secondary)]")}>
                          {n.text}
                        </span>
                        <span className="meta normal-case tracking-normal">{formatRelativeDate(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-[var(--accent)]" aria-label="Unread" />}
                    </>
                  )
                  const cls = "flex items-start gap-3 p-2.5 rounded-[14px] hover:bg-[var(--surface)] transition-colors"
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          className={cls}
                          onClick={() => {
                            markRead(n.id)
                            setOpen(false)
                          }}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  )
                })}
                {notifications.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">You&apos;re all caught up.</li>
                )}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
