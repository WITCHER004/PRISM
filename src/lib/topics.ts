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

/** The topics a story can be filed under (taxonomy, not content: post counts come from Firestore) */
export const TOPICS = [
  { id: "t1", name: "Infrastructure", slug: "infrastructure" },
  { id: "t2", name: "Policy", slug: "policy" },
  { id: "t3", name: "Design", slug: "design" },
  { id: "t4", name: "Science", slug: "science" },
  { id: "t5", name: "Reporting", slug: "reporting" },
  { id: "t6", name: "Philosophy", slug: "philosophy" },
  { id: "t7", name: "Climate", slug: "climate" },
  { id: "t8", name: "Craft", slug: "craft" },
  { id: "t9", name: "Programming", slug: "programming" },
  { id: "t10", name: "Culture", slug: "culture" },
] as const satisfies readonly { id: string; name: string; slug: string }[]

/** A Tag for any slug: a known topic, or one made from the slug itself */
export function tagFor(slug: string): { id: string; name: string; slug: string } {
  const known = TOPICS.find((t) => t.slug === slug || t.name.toLowerCase() === slug.toLowerCase())
  if (known) return { ...known }
  const name = slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return { id: "t_" + slug, name, slug }
}
