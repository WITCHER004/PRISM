"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { animate, motion, useInView, useReducedMotion } from "motion/react"
import { type Tag } from "@/lib/data"
import { hueStyle } from "@/lib/topics"
import { ease, stagger } from "@/lib/motion"

// Today's reading split by topic: one bar, one hue per topic
export function SpectrumBar({ tags }: { tags: Tag[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" })

  const total = tags.reduce((sum, t) => sum + (t.postCount ?? 0), 0) || 1
  const rows = [...tags]
    .sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0))
    .map((t) => ({ ...t, share: (t.postCount ?? 0) / total }))

  return (
    <div ref={ref}>
      <div className="flex h-3 w-full overflow-hidden rounded-full gap-[2px]" role="img" aria-label="Share of today's reading by topic">
        {rows.map((t, i) => (
          // Width is fixed by flex-grow; only the transform animates (no layout work per frame)
          <motion.div
            key={t.id}
            style={hueStyle(t.slug, { flexGrow: t.share, transformOrigin: "left" })}
            className="hue-dot h-full first:rounded-l-full last:rounded-r-full"
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.7, delay: 0.1 + i * stagger * 1.5, ease: ease.out }}
          />
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-1">
        {rows.slice(0, 8).map((t, i) => (
          <li key={t.id} style={hueStyle(t.slug)}>
            <Link
              href={`/explore/${t.slug}`}
              className="group flex items-center gap-2 py-1.5 text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)]"
            >
              <span className="w-2.5 h-2.5 rounded-[4px] hue-dot shrink-0 transition-transform group-hover:scale-125" />
              <span className="truncate flex-1">{t.name}</span>
              <span className="meta">
                <CountUp to={Math.round(t.share * 100)} start={inView} delay={0.1 + i * stagger * 1.5} />%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Counts from 0 to `to` alongside the bar filling in; shows the final value immediately under reduced motion
function CountUp({ to, start, delay }: { to: number; start: boolean; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!start || !ref.current) return
    if (reduce) {
      ref.current.textContent = String(to)
      return
    }
    const controls = animate(0, to, {
      duration: 0.7,
      delay,
      ease: ease.out,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [start, to, delay, reduce])

  // Server/initial render shows the real number, so it's correct without JS
  return <span ref={ref}>{to}</span>
}
