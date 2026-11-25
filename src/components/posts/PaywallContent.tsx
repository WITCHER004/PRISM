"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useUIStore } from "@/lib/store"
import { dur, ease } from "@/lib/motion"
import { usePaperAccess } from "@/components/papers/ElitePaper"
import { checkAccess, useAccessStatus, usePaywallBody } from "@/components/posts/paywallAccess"

// Server-enforced paywall (audit F-02): a locked story arrives as its preview only. The full text is
// fetched from the server, which decides who may read it (author, staff, Elite, or a recorded unlock).
// Nothing in the browser can unlock a story on its own.

/** Locked when the story is paywalled, or inside a <PaperScope> (Advanced Papers are Elite-only) */
function useLocked(paywalled: boolean) {
  const paper = usePaperAccess()
  return paywalled || paper.scoped
}

/** True when the reader may see the whole story: a free post, or the server has handed over its body */
export function usePostUnlocked(postId: string, paywalled: boolean) {
  const locked = useLocked(paywalled)
  const body = usePaywallBody(postId)
  return !locked || !!body
}

/** Ask the server once auth has settled, and again when the signed-in account changes */
function useAccessCheck(postId: string, locked: boolean) {
  const uid = useUIStore((s) => s.authUid)
  const authLoading = useUIStore((s) => s.authLoading)
  useEffect(() => {
    if (locked && !authLoading) void checkAccess(postId, uid)
  }, [postId, locked, uid, authLoading])
  return useAccessStatus(postId, uid)
}

/**
 * True once saved state has loaded and the page has painted. State that is already true at that
 * point (e.g. a story unlocked on a previous visit) applies instantly; later changes animate.
 */
function useAnimateChanges() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let raf = 0
    const arm = () => {
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setReady(true))))
    }
    if (useUIStore.persist.hasHydrated()) {
      arm()
      return () => cancelAnimationFrame(raf)
    }
    const unsub = useUIStore.persist.onFinishHydration(arm)
    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [])
  return ready
}

// Fade the last lines of the preview; the reveal stretches the mask so the fade slides off the end
const MASK = "linear-gradient(to bottom, black calc(100% - 14rem), transparent 100%)"
const REVEAL_MS = 900
const CURVE = `cubic-bezier(${ease.out.join(",")})`

interface PaywalledBodyProps {
  postId: string
  paywalled: boolean
  /** The story as the page has it: the full text when free, only the preview when locked */
  html: string
  /** Kept for callers; the server cuts the preview now */
  previewFraction?: number
  /** Fade over the locked preview (CSS mask-image) */
  mask?: string
}

type Phase = "locked" | "measure" | "revealing" | "open"

// Story body. Locked: only the preview blocks show, fading out at the bottom. Unlocking shows the
// rest, releases the height from the preview's to the full story's and slides the fade off the end.
export function PaywalledBody({ postId, paywalled, html, mask = MASK }: PaywalledBodyProps) {
  const locked = useLocked(paywalled)
  useAccessCheck(postId, locked)
  const unlocked = usePostUnlocked(postId, paywalled)
  const body = usePaywallBody(postId)
  const animate = useAnimateChanges()
  const ref = useRef<HTMLDivElement>(null)
  const markup = locked && body ? body : html
  const [phase, setPhase] = useState<Phase>(unlocked ? "open" : "locked")
  const [heights, setHeights] = useState({ from: 0, to: 0 })

  useLayoutEffect(() => {
    if (!unlocked) {
      setPhase("locked")
      return
    }
    if (phase !== "locked") return
    if (!animate) {
      setPhase("open")
      return
    }
    setHeights({ from: ref.current?.offsetHeight ?? 0, to: 0 })
    setPhase("measure")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, animate])

  // Rest of the story is in the DOM but held at the preview height: measure, then animate open
  useLayoutEffect(() => {
    if (phase !== "measure") return
    const to = ref.current?.scrollHeight ?? 0
    setHeights((h) => ({ ...h, to }))
    const raf = requestAnimationFrame(() => setPhase("revealing"))
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    if (phase !== "revealing") return
    const t = setTimeout(() => setPhase("open"), REVEAL_MS + 150) // in case transitionend never fires
    return () => clearTimeout(t)
  }, [phase])

  const style: React.CSSProperties | undefined =
    phase === "open"
      ? undefined
      : {
          overflow: phase === "locked" ? undefined : "hidden",
          maxHeight: phase === "measure" ? heights.from : phase === "revealing" ? heights.to : undefined,
          maskImage: mask,
          WebkitMaskImage: mask,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: phase === "revealing" ? "100% 400%" : "100% 100%",
          WebkitMaskSize: phase === "revealing" ? "100% 400%" : "100% 100%",
          transition:
            phase === "revealing"
              ? `max-height ${REVEAL_MS}ms ${CURVE}, mask-size ${REVEAL_MS}ms ${CURVE}, -webkit-mask-size ${REVEAL_MS}ms ${CURVE}`
              : undefined,
        }

  return (
    <div
      ref={ref}
      className="prose-prism mx-auto"
      style={style}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "max-height") setPhase("open")
      }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

/**
 * Renders children only once the story is readable. Free stories render them on the server as usual;
 * on locked stories they fade up after an unlock (or instantly when it was unlocked on an earlier visit).
 */
export function UnlockedOnly({
  postId,
  paywalled,
  children,
  delay = 0,
  rise = true,
}: {
  postId: string
  paywalled: boolean
  children: React.ReactNode
  delay?: number
  /** false = fade only (needed around position:fixed children, which a transform would re-anchor) */
  rise?: boolean
}) {
  const unlocked = usePostUnlocked(postId, paywalled)
  const animate = useAnimateChanges()
  if (!paywalled) return <>{children}</>
  return (
    <AnimatePresence initial={false}>
      {unlocked && (
        <motion.div
          key="unlocked"
          initial={animate ? (rise ? { opacity: 0, y: 12 } : { opacity: 0 }) : false}
          animate={{ opacity: 1, ...(rise ? { y: 0 } : {}), transition: { duration: dur.slow, ease: ease.out, delay } }}
          exit={{ opacity: 0, transition: { duration: dur.fast } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Inverse of UnlockedOnly: content shown only while the story is still locked (e.g. the gate). */
export function LockedOnly({ postId, paywalled, children }: { postId: string; paywalled: boolean; children: React.ReactNode }) {
  const locked = useLocked(paywalled)
  const status = useAccessCheck(postId, locked)
  const unlocked = usePostUnlocked(postId, paywalled)
  return (
    <AnimatePresence initial={false}>
      {/* While the server is checking (e.g. an Elite reader), don't flash the gate */}
      {locked && !unlocked && status !== "checking" && (
        <motion.div
          key="locked"
          exit={{ opacity: 0, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
