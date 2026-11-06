import type { CSSProperties } from "react"

// Each topic owns a hue on the spectrum. Components read it through the
// `--hue` custom property (see .hue-* utilities in globals.css).
const TOPIC_HUES: Record<string, number> = {
  writing: 25,
  startups: 50,
  philosophy: 80,
  productivity: 115,
  climate: 155,
  science: 200,
  programming: 230,
  technology: 255,
  "ai-ml": 290,
  design: 335,
}

export function topicHue(slug?: string): number {
  if (!slug) return 270
  if (slug in TOPIC_HUES) return TOPIC_HUES[slug]
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export function hueStyle(slug?: string, extra?: CSSProperties): CSSProperties {
  return { ["--hue" as string]: topicHue(slug), ...extra }
}
