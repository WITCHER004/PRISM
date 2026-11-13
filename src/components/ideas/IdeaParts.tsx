"use client"

import { Avatar } from "@/components/ui/Avatar"
import { CORAL, isUrgent, lifeLeft, THEMES, timeLeft, type IdeaFormat, type IdeaTheme, type InstantIdea } from "@/lib/ideas"
import { cn } from "@/lib/utils"

/** Canvases dark enough to need light controls */
export const isDarkCanvas = (theme: IdeaTheme) => theme === "obsidian" || theme === "blueprint"

/** Translucent chip/button surface that reads on the idea's canvas */
export const chipSurface = (theme: IdeaTheme) =>
  isDarkCanvas(theme) ? "bg-white/12 hover:bg-white/20" : "bg-black/[0.06] hover:bg-black/[0.11]"

/**
 * Avatar inside a ring that drains as the idea's life runs out. Coral in the last hour.
 * `seen` dims the ring once the viewer has opened the idea.
 */
export function CountdownRing({ idea, now, size = 40, seen }: { idea: InstantIdea; now: number; size?: number; seen?: boolean }) {
  const stroke = 2.25
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const theme = THEMES[idea.theme]
  const color = isUrgent(idea, now) ? CORAL : theme.ring
  const left = lifeLeft(idea, now)
  const inner = size - 8
  return (
    <span className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left)}
          opacity={seen ? 0.45 : 1}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span style={{ width: inner, height: inner }} className="relative">
        <Avatar src={idea.authorAvatar} alt={idea.authorName} size="xs" className="w-full h-full bg-[#141413] text-[#f4f1ea] font-serif text-[10px]" />
      </span>
    </span>
  )
}

/** "21h left" pill; coral in the last hour */
export function TimePill({ idea, now, className }: { idea: InstantIdea; now: number; className?: string }) {
  const urgent = isUrgent(idea, now)
  return (
    <span
      style={urgent ? { backgroundColor: CORAL } : undefined}
      className={cn(
        "inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium tabular-nums whitespace-nowrap",
        urgent ? "text-white" : cn(chipSurface(idea.theme), THEMES[idea.theme].ink),
        className
      )}
    >
      {timeLeft(idea, now)}
    </span>
  )
}

/** The idea's words, styled by format. `story` is the full-screen size. */
export function IdeaBody({
  text,
  format,
  theme,
  size = "card",
  className,
}: {
  text: string
  format: IdeaFormat
  theme: IdeaTheme
  size?: "card" | "story"
  className?: string
}) {
  const ink = THEMES[theme].ink
  const story = size === "story"
  if (format === "code") {
    return (
      <pre
        className={cn(
          "font-mono whitespace-pre-wrap break-words",
          ink,
          story ? "text-[15px] leading-relaxed p-4 rounded-[14px] bg-black/15" : "text-[12px] leading-[1.45] line-clamp-2",
          className
        )}
      >
        {text}
      </pre>
    )
  }
  if (format === "quote") {
    return (
      <blockquote
        className={cn(
          "font-serif italic break-words",
          ink,
          story ? "text-[1.75rem] sm:text-[2rem] leading-[1.22]" : "text-[15px] leading-snug line-clamp-2",
          className
        )}
      >
        <span aria-hidden className="not-italic opacity-50">“</span>
        {text}
        <span aria-hidden className="not-italic opacity-50">”</span>
      </blockquote>
    )
  }
  return (
    <p
      className={cn(
        "break-words",
        ink,
        story
          ? "font-display text-[1.5rem] sm:text-[1.75rem] font-semibold leading-[1.22] tracking-[-0.02em]"
          : "text-[14px] font-medium leading-snug line-clamp-2",
        className
      )}
    >
      {text}
    </p>
  )
}
