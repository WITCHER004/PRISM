"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useUIStore } from "@/lib/store"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { usePaperAccess } from "@/components/papers/ElitePaper"

// Demo paywall: the full story HTML is always sent and only hidden on screen. Real gating needs
// the server to withhold the locked part until the reader is entitled to it.

/**
 * True when the reader may see the whole story (free post, unlocked here, or any membership).
 * Inside a <PaperScope> (Advanced Papers) only Elite, the author or the dev demo view unlock it.
 */
export function usePostUnlocked(postId: string, paywalled: boolean) {
  const paper = usePaperAccess()
  const open = useUIStore((s) => !paywalled || s.plan !== null || s.unlockedPosts.has(postId))
  return paper.scoped ? paper.canRead : open
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

/**
 * Tag every top-level block after the preview cut with .pw-rest so the locked state can hide them
 * with CSS. Cutting by blocks (not a fixed height) keeps the preview a real share of any story.
 */
function markPreviewCut(html: string, fraction: number) {
  const blocks = /<(p|h[1-6]|blockquote|ul|ol|pre|figure|table|div|section)(\s[^>]*)?>[\s\S]*?<\/\1>|<(hr|img)\b[^>]*\/?>/g
  const matches = [...html.matchAll(blocks)]
  if (matches.length < 3) return html
  const keep = Math.max(2, Math.min(matches.length - 1, Math.round(matches.length * fraction)))
  let out = ""
  let last = 0
  matches.forEach((m, i) => {
    const at = m.index ?? 0
    out += html.slice(last, at)
    out += i >= keep ? m[0].replace(/^<([a-z0-9]+)/i, (_t, tag: string) => `<${tag} data-pw-rest=""`) : m[0]
    last = at + m[0].length
  })
  return out + html.slice(last)
}

interface PaywalledBodyProps {
  postId: string
  paywalled: boolean
  html: string
  /** Share of the story's blocks shown as the preview while locked (0–1) */
  previewFraction?: number
  /** Fade over the locked preview (CSS mask-image) */
  mask?: string
}

type Phase = "locked" | "measure" | "revealing" | "open"

// Story body. Locked: only the preview blocks show, fading out at the bottom. Unlocking shows the
// rest, releases the height from the preview's to the full story's and slides the fade off the end.
export function PaywalledBody({ postId, paywalled, html, previewFraction = 0.4, mask = MASK }: PaywalledBodyProps) {
  const unlocked = usePostUnlocked(postId, paywalled)
  const animate = useAnimateChanges()
  const ref = useRef<HTMLDivElement>(null)
  const markup = useMemo(() => (paywalled ? markPreviewCut(html, previewFraction) : html), [html, paywalled, previewFraction])
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
      className={cn("prose-prism mx-auto", phase === "locked" && "[&_[data-pw-rest]]:hidden")}
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
  const unlocked = usePostUnlocked(postId, paywalled)
  return (
    <AnimatePresence initial={false}>
      {paywalled && !unlocked && (
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
