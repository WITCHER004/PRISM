"use client"

import { useId, useState, type CSSProperties, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import type { Tag } from "@/lib/data"
import { cn } from "@/lib/utils"

// One beam in, seven topics out. Order is top → bottom.
// `ray` colours the light (and the label in light mode); `dark` is the label colour on dark.
export const SPECTRUM_BANDS = [
  { slug: "programming", name: "Programming", ray: "#7C3AED", dark: "#A78BFA" },
  { slug: "infrastructure", name: "Infrastructure", ray: "#4F46E5", dark: "#818CF8" },
  { slug: "design", name: "Design", ray: "#0284C7", dark: "#38BDF8" },
  { slug: "science", name: "Science", ray: "#16A34A", dark: "#4ADE80" },
  { slug: "policy", name: "Policy", ray: "#D97706", dark: "#FBBF24" },
  { slug: "culture", name: "Culture", ray: "#EA580C", dark: "#FB923C" },
  { slug: "philosophy", name: "Philosophy", ray: "#DC2626", dark: "#F87171" },
] as const

type Band = (typeof SPECTRUM_BANDS)[number] & { pct: number }

/* ── Geometry (viewBox 440×230) ────────────────────────────────────────────────
   The prism is a photo (public/prism-3d.webp: studio backdrop flattened to pure white, colour
   neutralised, edges sharpened, cropped tight, exported at 3× its drawn size). Every anchor
   below was measured on its silhouette: left face x = 595.25 − 0.526·y, right face
   x = 479.15 + 0.461·y in source pixels, mapped through the crop and IMG. */
type Pt = readonly [number, number]
const W = 440
const H = 230
const IMG = { x: 66.5, y: 42.5, w: 172.9, h: 166.94 }
const IMG_BOX: CSSProperties = {
  left: `${(IMG.x / W) * 100}%`,
  top: `${(IMG.y / H) * 100}%`,
  width: `${(IMG.w / W) * 100}%`,
  height: `${(IMG.h / H) * 100}%`,
}
const BEAM_X = 16
const TEXT_X = 20 // "Your idea" label, kept clear of the card's left edge
const E: Pt = [89.1, 122] // where the beam meets the left glass face
// Where each ray leaves the right face, top → bottom (spread down the face, not bunched)
const EXIT: Pt[] = [
  [177.26, 105.7],
  [179.72, 111.05],
  [182.18, 116.39],
  [184.64, 121.73],
  [187.1, 127.08],
  [189.57, 132.42],
  [192.03, 137.76],
]
const DOT_X = 312
const LABEL_X = DOT_X + 8.5 // ≈ gap-2.5 at the card's rendered scale
const rowY = (i: number) => 22 + 31 * i

/** Leaves the glass on a gently fanned tangent, then S-curves flat into its label's dot. */
function rayPath([x0, y0]: Pt, i: number, ly: number) {
  const span = DOT_X - x0
  const slope = (i - 3) * 0.07
  const c1x = x0 + span * 0.42
  return `M${x0},${y0} C${c1x},${y0 + slope * span * 0.42} ${DOT_X - span * 0.46},${ly} ${DOT_X},${ly}`
}

// Warm studio-paper surface: the photo multiplies into it with no visible edge
const CARD =
  "rounded-3xl border border-[rgba(20,20,19,0.08)] bg-[linear-gradient(145deg,#FAF8F5_0%,#F8F6F2_100%)] shadow-[0_12px_32px_-8px_rgba(20,20,19,0.06),inset_0_1px_0_#FFFFFF] " +
  "theme-dark:border-white/[0.08] theme-dark:bg-[linear-gradient(145deg,#161618_0%,#111113_100%)] theme-dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"

const crisp = { vectorEffect: "non-scaling-stroke" } as const
const ease = (...props: string[]) => props.map((p) => `${p} .3s ease`).join(", ")

export function SpectrumCard({ tags, activeTopic }: { tags: Tag[]; activeTopic?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const router = useRouter()
  const [hover, setHover] = useState<number | null>(null)
  const [hot, setHot] = useState(false)

  // Share of all of today's reading, so the seven don't add to 100%
  const total = tags.reduce((sum, t) => sum + (t.postCount ?? 0), 0) || 1
  const bands: Band[] = SPECTRUM_BANDS.map((b) => ({
    ...b,
    pct: Math.round(((tags.find((t) => t.slug === b.slug)?.postCount ?? 0) / total) * 100),
  }))

  const selected = bands.findIndex((b) => b.slug === activeTopic)
  const lit = hover ?? (selected >= 0 ? selected : null)
  const state = (i: number) => (lit === null ? "idle" : lit === i ? "lit" : "dim")

  // SVG <a> keeps keyboard focus + middle-click; left-click goes through the client router
  const go = (href: string) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    router.push(href)
  }

  return (
    <div data-spectrum-card className={cn("p-6 overflow-hidden", CARD)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-[#141413] theme-dark:text-[var(--fg)]">Today&apos;s spectrum</h2>
        <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-stone-400">What people are reading</span>
      </div>

      {/* Three layers: light, then the glass photo over it, then the labels. Because the photo lies
          ON the light, its real edges and reflections cross the beam, so the light travels through
          the crystal instead of being pasted around it. */}
      <div className="relative mt-4 w-full max-w-[440px] mx-auto">
        {/* 1 · Light (in flow: sizes the box) */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`${id}-beam`} gradientUnits="userSpaceOnUse" x1={BEAM_X} y1="0" x2={E[0]} y2="0">
              <stop offset="0" stopColor="#F59E0B" stopOpacity="0" />
              <stop offset="0.3" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            {/* Inside the glass: warm white light turning into each hue as it nears the exit face */}
            {bands.map((b, i) => (
              <linearGradient key={b.slug} id={`${id}-in${i}`} gradientUnits="userSpaceOnUse" x1={E[0]} y1="0" x2={EXIT[i][0]} y2="0">
                <stop offset="0" stopColor="#F59E0B" stopOpacity="0.75" />
                <stop offset="1" stopColor={b.ray} stopOpacity="0.9" />
              </linearGradient>
            ))}
          </defs>

          {/* Incoming beam: one crisp 2px amber line, fading in on the left */}
          <line
            x1={BEAM_X} y1={E[1]} x2={E[0]} y2={E[1]}
            stroke={`url(#${id}-beam)`}
            strokeLinecap="round"
            style={{ ...crisp, strokeWidth: 2, filter: hot ? "drop-shadow(0 0 4px rgba(245,158,11,0.6))" : "none", transition: ease("filter") }}
          />

          {/* Through the glass: seven hairlines splitting from the entry point to the exit face */}
          {bands.map((b, i) => (
            <line
              key={b.slug}
              x1={E[0]} y1={E[1]} x2={EXIT[i][0]} y2={EXIT[i][1]}
              stroke={`url(#${id}-in${i})`}
              style={{ ...crisp, strokeWidth: 1, opacity: state(i) === "dim" ? 0.3 : 1, transition: ease("opacity") }}
            />
          ))}

          {/* Out into the air: one crisp 2px stroke each, into a 4px dot. Only the hovered ray glows. */}
          {bands.map((b, i) => {
            const s = state(i)
            return (
              <g
                key={b.slug}
                style={{
                  color: b.ray,
                  opacity: s === "dim" ? 0.35 : 1,
                  filter: s === "lit" ? "drop-shadow(0 0 6px currentColor)" : "none",
                  transition: ease("opacity", "filter"),
                }}
              >
                <path
                  d={rayPath(EXIT[i], i, rowY(i))}
                  stroke={b.ray}
                  strokeOpacity="0.95"
                  strokeLinecap="round"
                  fill="none"
                  style={{ ...crisp, strokeWidth: s === "lit" ? 2.5 : 2, transition: ease("stroke-width") }}
                />
                <circle cx={DOT_X} cy={rowY(i)} r="2" fill={b.ray} />
              </g>
            )
          })}
        </svg>

        {/* 2 · The glass. Multiply drops its white backdrop into the card and lays its edges over the
            light; on dark, the inverted photo screens in (black backdrop vanishes, edges glow). */}
        <img
          src="/prism-3d.webp"
          alt="Prism"
          width={519}
          height={501}
          draggable={false}
          className="absolute object-contain select-none pointer-events-none mix-blend-multiply theme-dark:mix-blend-screen theme-dark:[filter:invert(1)_hue-rotate(180deg)]"
          style={IMG_BOX}
        />

        {/* 3 · Labels and links */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full overflow-visible"
          role="group"
          aria-label="Share of today's reading by topic"
        >
          {/* "Your idea" → editor; hovering glows the beam */}
          <a
            href="/editor/new"
            onClick={go("/editor/new")}
            onMouseEnter={() => setHot(true)}
            onMouseLeave={() => setHot(false)}
            onFocus={() => setHot(true)}
            onBlur={() => setHot(false)}
            className="cursor-pointer outline-none [&:focus-visible>text]:underline"
          >
            <rect x={TEXT_X - 4} y={E[1] - 24} width="72" height="20" fill="transparent" />
            <text x={TEXT_X} y={E[1] - 9} className="text-xs font-medium fill-amber-900/80 theme-dark:fill-amber-300/90">
              Your idea
            </text>
          </a>

          {/* Topic rows: hover lights the ray, click filters the feed (click again to clear) */}
          {bands.map((b, i) => {
            const isSelected = i === selected
            const href = isSelected ? "/#feed" : `/?topic=${b.slug}#feed`
            const ly = rowY(i)
            const s = state(i)
            // Soft bloom lift on the active row's text
            const lift: CSSProperties = {
              filter: s === "lit" ? `drop-shadow(0 1px 5px color-mix(in srgb, ${b.ray} 45%, transparent))` : "none",
              transition: ease("filter"),
            }
            return (
              <a
                key={b.slug}
                href={href}
                onClick={go(href)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${b.name}, ${b.pct}% of today's reading. ${isSelected ? "Clear filter" : `Show ${b.name} stories`}`}
                aria-current={isSelected ? "true" : undefined}
                style={{ "--rc": b.ray, "--rc-d": b.dark, opacity: s === "dim" ? 0.5 : 1, transition: ease("opacity") } as CSSProperties}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--rc)]"
              >
                <rect
                  x={DOT_X - 7} y={ly - 12} width={W - DOT_X + 7} height="24" rx="12"
                  className="fill-[color-mix(in_srgb,var(--rc)_9%,transparent)] stroke-transparent"
                  strokeWidth="1"
                  style={{ fillOpacity: s === "lit" ? 1 : 0, transition: ease("fill-opacity") }}
                />
                <text
                  x={LABEL_X} y={ly} dominantBaseline="central"
                  className="fill-[var(--rc)] theme-dark:fill-[var(--rc-d)] text-[12px] font-semibold tracking-tight"
                  style={lift}
                >
                  {b.name}
                </text>
                <text
                  x={W - 4} y={ly} dominantBaseline="central" textAnchor="end"
                  className="fill-[var(--rc)] theme-dark:fill-[var(--rc-d)] text-[12px] font-medium"
                  style={{ ...lift, fontVariantNumeric: "tabular-nums", opacity: s === "lit" ? 0.95 : 0.7 }}
                >
                  {b.pct}%
                </text>
              </a>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
