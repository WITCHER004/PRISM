"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { type Post } from "@/lib/data"
import { useUIStore, toast } from "@/lib/store"
import { DialogShell } from "@/components/posts/DialogShell"
import { copyText } from "@/components/posts/copyText"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { ArrowRight, BookOpen, Check, CreditCard, Loader2, Lock, LogIn, Share2, Sparkles } from "lucide-react"

interface PaywallGateProps {
  post: Post
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-sm font-medium bg-[var(--panel)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-50"

// The end-of-preview card on locked stories. Every path ends in unlockPost (demo) or a real page.
export function PaywallGate({ post }: PaywallGateProps) {
  const pathname = usePathname()
  const currentUser = useUIStore((s) => s.currentUser)
  const unlockPost = useUIStore((s) => s.unlockPost)
  const [sharing, setSharing] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const price = post.paywallPrice ?? 2
  const loginHref = `/auth/login?redirectTo=${encodeURIComponent(pathname)}`
  const tier = post.paywallTier

  const shareToUnlock = async () => {
    const url = window.location.href.split("#")[0]
    setSharing(true)
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: post.subtitle ?? post.excerpt, url })
        toast("Thanks for sharing — story unlocked", { tone: "success" })
        unlockPost(post.id)
        return
      } catch (err) {
        // Closing the share sheet means "not now"; any other failure falls back to copying the link
        if (err instanceof DOMException && err.name === "AbortError") {
          setSharing(false)
          return
        }
      }
    }
    if (await copyText(url)) {
      toast("Link copied — share it anywhere. Story unlocked", { tone: "success" })
      unlockPost(post.id)
    } else {
      toast("Couldn’t share this story. Try again.", { tone: "error" })
      setSharing(false)
    }
  }

  const readFree = () => {
    unlockPost(post.id)
    toast("Unlocked with one of your free stories this month", { tone: "success" })
  }

  const heading =
    tier === "METERED" ? "Keep reading" : tier === "PAID" ? "Unlock this story" : "For members"
  const body =
    tier === "METERED"
      ? currentUser
        ? "You’ve reached the end of the preview. Your free account includes a few member stories each month."
        : "You’ve reached the end of the preview. Sign in for free to keep reading, or get full access with a membership."
      : tier === "PAID"
      ? `Support ${post.author.displayName} directly and unlock this story with a one-time payment.`
      : `This story is for members. Join to read it, and everything else on Prism.`

  return (
    <div className="relative mt-2">
      <div className="relative overflow-hidden panel shadow-[var(--shadow-lift)] px-6 py-10 sm:px-10 text-center">
        <div aria-hidden className="absolute inset-0 hue-glow opacity-50" />
        <div className="relative">
          <span className="grid place-items-center w-12 h-12 mx-auto rounded-full hue-wash hue-ink">
            <Lock className="w-5 h-5" />
          </span>
          <h2 className="display text-[2rem] mt-4">{heading}</h2>
          <p className="mt-2 text-[var(--fg-muted)] text-[0.9375rem] max-w-md mx-auto leading-relaxed">{body}</p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            {tier === "PAID" || tier === "SUBSCRIBER" ? (
              tier === "PAID" ? (
                <button type="button" className={primaryBtn} onClick={() => setPayOpen(true)}>
                  <Sparkles className="w-4 h-4" /> Unlock for ${price.toFixed(2)}
                </button>
              ) : (
                <Link href="/membership" className={primaryBtn}>
                  <Sparkles className="w-4 h-4" /> Become a member
                </Link>
              )
            ) : currentUser ? (
              <button type="button" className={primaryBtn} onClick={readFree}>
                <BookOpen className="w-4 h-4" /> Keep reading — free
              </button>
            ) : (
              <Link href={loginHref} className={primaryBtn}>
                <LogIn className="w-4 h-4" /> Sign in to keep reading
              </Link>
            )}

            <button type="button" className={secondaryBtn} onClick={shareToUnlock} disabled={sharing} aria-busy={sharing}>
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {sharing ? "Unlocking…" : "Share to unlock"}
            </button>
          </div>

          <div className="mt-7 pt-6 border-t border-[var(--border)] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link
              href="/membership"
              className="inline-flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              Prism membership · from $8/mo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {tier === "SUBSCRIBER" && (
              <button
                type="button"
                onClick={() => setPayOpen(true)}
                className="text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-4 decoration-[var(--border-strong)] transition-colors"
              >
                Or unlock just this story · ${price.toFixed(2)}
              </button>
            )}
            {!currentUser && (
              <span className="text-[var(--fg-muted)]">
                Already a member?{" "}
                <Link href={loginHref} className="text-[var(--fg)] font-medium underline underline-offset-4">
                  Sign in
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      <UnlockDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        post={post}
        price={price}
        onPaid={() => {
          setPayOpen(false)
          // Let the dialog finish closing before the gate itself animates away
          setTimeout(() => {
            unlockPost(post.id)
            toast(`Unlocked “${post.title}”`, { tone: "success" })
          }, 220)
        }}
      />
    </div>
  )
}

// Simulated one-time payment (no payment provider in demo mode)
function UnlockDialog({
  open,
  onClose,
  onPaid,
  post,
  price,
}: {
  open: boolean
  onClose: () => void
  onPaid: () => void
  post: Post
  price: number
}) {
  const [phase, setPhase] = useState<"idle" | "processing" | "paid">("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) setPhase("idle")
  }, [open])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const pay = () => {
    setPhase("processing")
    timer.current = setTimeout(() => {
      setPhase("paid")
      timer.current = setTimeout(onPaid, 650)
    }, 1000)
  }

  return (
    <DialogShell open={open} onClose={onClose} label="Unlock this story" locked={phase !== "idle"}>
      <p className="meta">One-time unlock</p>
      <h2 className="display text-[1.5rem] mt-1 pr-10">Unlock this story</h2>

      <div className="mt-5 rounded-[16px] bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
        <p className="font-medium leading-snug line-clamp-2">{post.title}</p>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">by {post.author.displayName}</p>
        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-sm">
          <span className="text-[var(--fg-muted)]">Total</span>
          <span className="font-semibold tabular-nums">${price.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 h-12 px-4 rounded-[16px] border border-[var(--border)] bg-[var(--panel)] text-sm">
        <CreditCard className="w-4 h-4 text-[var(--fg-muted)]" />
        <span className="flex-1">Demo card •••• 4242</span>
        <span className="meta">12/29</span>
      </div>

      <button
        type="button"
        onClick={pay}
        disabled={phase !== "idle"}
        data-autofocus
        className={cn(primaryBtn, "mt-5 w-full", phase === "paid" && "disabled:opacity-100")}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={phase}
            className="inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.fast, ease: ease.out } }}
            exit={{ opacity: 0, y: -4, transition: { duration: dur.fast } }}
          >
            {phase === "processing" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </>
            ) : phase === "paid" ? (
              <>
                <Check className="w-4 h-4" /> Paid — unlocking
              </>
            ) : (
              <>Pay ${price.toFixed(2)}</>
            )}
          </motion.span>
        </AnimatePresence>
      </button>
      <p className="mt-3 text-center meta">Demo mode · no card will be charged</p>
    </DialogShell>
  )
}
