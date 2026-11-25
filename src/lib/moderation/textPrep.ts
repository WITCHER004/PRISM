// Text preparation shared by the heuristic AI check and the lexical plagiarism check. It mirrors
// ai_plagiarism_engine/text_prep.py so both detectors see the same prose:
//  - code (<pre>, <code>, ``` fences, `inline`) is removed: low-entropy code reads "machine-like"
//    to every prose detector and must never inflate the AI score;
//  - quotations the author attributes (blockquotes, quoted spans with "said", "(Smith, 2019)", "[3]")
//    are excluded from both the AI score and plagiarism;
//  - the rest is split into paragraphs and sentences.
// Safe to import from client and server.

import type { DetectorDomain } from "./types"

export type { DetectorDomain }
export const DETECTOR_DOMAINS: readonly DetectorDomain[] = ["programming", "infrastructure", "academic", "essay", "journalism", "general"]

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" }
const decode = (s: string) => s.replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m)
// Every pattern below runs in linear time on hostile input (no nested or overlapping unbounded
// quantifiers): article text reaches this from an HTTP request, and a quadratic regex on a run of
// "<" or "\n" characters would block the server (audit finding F-05).
const stripTags = (s: string) => s.replace(/<[^<>]{0,2000}>/g, " ")

/** Longest text the checks look at. Longer input is cut, so cost stays bounded even if a pattern regresses */
export const MAX_ANALYZED_CHARS = 200_000

/**
 * Replaces every `<tag …>…</tag>` block (case-insensitive) using indexOf scans, so it is linear in the
 * input. An unclosed block runs to the end of the text.
 */
export function replaceBlocks(src: string, tag: string, fn: (inner: string) => string): string {
  const lower = src.toLowerCase()
  const open = `<${tag}`
  const close = `</${tag}`
  let out = ""
  let i = 0
  for (;;) {
    let j = lower.indexOf(open, i)
    // Skip longer tag names that merely start the same way (<pre> vs <prelude>)
    while (j !== -1 && /[a-z0-9]/.test(lower[j + open.length] ?? "")) j = lower.indexOf(open, j + 1)
    if (j === -1) return out + src.slice(i)
    const tagEnd = lower.indexOf(">", j)
    if (tagEnd === -1) return out + src.slice(i, j) + fn("")
    const c = lower.indexOf(close, tagEnd)
    if (c === -1) return out + src.slice(i, j) + fn(src.slice(tagEnd + 1))
    const closeEnd = lower.indexOf(">", c)
    out += src.slice(i, j) + fn(src.slice(tagEnd + 1, c))
    i = closeEnd === -1 ? src.length : closeEnd + 1
  }
}

/** Removes ``` / ~~~ fenced blocks line by line (an unclosed fence runs to the end) */
function stripFences(src: string, onBlock: () => void): string {
  const out: string[] = []
  let fence: string | null = null
  for (const line of src.split("\n")) {
    const m = /^[ \t]*(```|~~~)/.exec(line)
    if (fence) {
      if (m && m[1] === fence) fence = null
      continue
    }
    if (m) {
      fence = m[1]
      onBlock()
      out.push("")
      continue
    }
    out.push(line)
  }
  return out.join("\n")
}

const WORD_RE = /[\p{L}\p{M}\p{N}’']+(?:-[\p{L}\p{M}\p{N}]+)*/gu
export const tokens = (text: string) => text.toLowerCase().match(WORD_RE) ?? []

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((p) =>
      p
        .replace(/\s+/g, " ")
        .trim()
        .split(/(?<=[.!?…])["”’)\]]?\s+(?=["“‘(\[]?[A-Z0-9])/)
    )
    .map((s) => s.trim())
    .filter((s) => tokens(s).length > 0)
}

const QUOTED_SPAN = /["“]([^"”]{25,600})["”]/g
const ATTRIBUTION =
  /\b(?:said|says|wrote|writes|argued|argues|noted|notes|observed|according to|in the words of|told|explained|stated|states|claims|claimed)\b|\(\s*[A-Z][A-Za-z-]+(?: et al\.)?,?\s*\d{4}[a-z]?(?:,\s*p+\.\s*\d+)?\s*\)|\[\d{1,3}(?:[,–-]\s*\d{1,3})*\]|[—–]\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}\s*$/

export interface PreparedText {
  /** Author's own prose: code and attributed quotations removed, paragraphs separated by "\n" */
  prose: string
  paragraphs: string[]
  sentences: string[]
  /** Words in the original text (the 150-word gate counts these) */
  wordCount: number
  proseWordCount: number
  codeBlocks: number
  excludedQuotes: number
}

/**
 * Editor HTML (or markdown-ish text) → prepared prose. Also used to build the text sent to the ML
 * engine (see toEngineText), which applies the same rules server-side.
 */
export function prepareText(input: string): PreparedText {
  let codeBlocks = 0
  let excludedQuotes = 0
  let t = (input ?? "").slice(0, MAX_ANALYZED_CHARS)
  const all = tokens(decode(stripTags(t.replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, "\n")))).length

  t = replaceBlocks(t, "pre", () => (codeBlocks++, "\n\n"))
  t = stripFences(t, () => codeBlocks++)
  t = replaceBlocks(t, "code", () => "CODE")
  t = t.replace(/`[^`\n]{1,200}`/g, "CODE")
  t = replaceBlocks(t, "blockquote", () => (excludedQuotes++, "\n\n"))
  t = t.replace(/^[ \t]*>[^\n]*$/gm, () => (excludedQuotes++, ""))
  t = replaceBlocks(replaceBlocks(t, "script", () => " "), "style", () => " ")
  t = t.replace(/<\/(p|h[1-6]|li|div)>|<br\s*\/?>/gi, "\n")
  t = decode(stripTags(t)).replace(/[ \t]+/g, " ")

  const paragraphs: string[] = []
  for (const raw of t.split(/\n+/)) {
    const sents = splitSentences(raw).map((s) =>
      ATTRIBUTION.test(s)
        ? s.replace(QUOTED_SPAN, (m, inner: string) => (tokens(inner).length >= 6 ? (excludedQuotes++, "“…”") : m))
        : s
    )
    if (sents.length) paragraphs.push(sents.join(" "))
  }
  const prose = paragraphs.join("\n")
  return {
    prose,
    paragraphs,
    sentences: splitSentences(prose),
    wordCount: all,
    proseWordCount: tokens(prose).length,
    codeBlocks,
    excludedQuotes,
  }
}

/** HTML → markdown-ish text for the ML engine: keeps ``` fences and "> " quote markers so it can strip them */
export function toEngineText(html: string): string {
  html = html.slice(0, MAX_ANALYZED_CHARS)
  if (!/<(p|div|br|h\d|li|pre|code|blockquote)\b/i.test(html)) return html
  let t = replaceBlocks(html, "pre", (c) => `\n\`\`\`\n${stripTags(c)}\n\`\`\`\n`)
  t = replaceBlocks(t, "code", (c) => "`" + stripTags(c).replace(/`/g, "'") + "`")
  t = replaceBlocks(t, "blockquote", (c) =>
    "\n" +
    stripTags(c.replace(/<\/(p|div)>|<br\s*\/?>/gi, "\n"))
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => `> ${l.trim()}`)
      .join("\n") +
    "\n"
  )
  t = replaceBlocks(replaceBlocks(t, "script", () => " "), "style", () => " ")
  return decode(stripTags(t.replace(/<\/(p|h[1-6]|li|div)>|<br\s*\/?>/gi, "\n")))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// --- Domains ---------------------------------------------------------------------------------------

/** Prism topic slug → detector domain */
const TOPIC_TO_DOMAIN: Record<string, DetectorDomain> = {
  programming: "programming",
  "ai-ml": "programming",
  technology: "programming",
  infrastructure: "infrastructure",
  science: "academic",
  climate: "academic",
  philosophy: "essay",
  culture: "essay",
  craft: "essay",
  design: "essay",
  writing: "essay",
  policy: "journalism",
  reporting: "journalism",
}

const LEXICON: Record<Exclude<DetectorDomain, "general">, Set<string>> = {
  programming: new Set(
    "function variable compiler runtime api library framework python javascript typescript rust java code bug debug refactor repository git commit test tests unit async await thread loop array string integer class method object interface type types npm package module import syntax parse query sql database endpoint".split(" ")
  ),
  infrastructure: new Set(
    "kubernetes cluster node nodes container docker latency throughput availability replica replication shard sharding load balancer cache caching cdn region failover terraform deployment pipeline observability metrics outage incident sla slo scaling autoscaling queue kafka microservice microservices network bandwidth".split(" ")
  ),
  academic: new Set(
    "study studies hypothesis experiment experiments participants sample data dataset results significant analysis method methods methodology findings evidence model models theory empirical paper research researchers cell cells protein species climate emissions measurement statistical correlation abstract we propose".split(" ")
  ),
  essay: new Set(
    "meaning self consciousness moral morality ethics virtue truth beauty freedom memory grief love death culture art literature history identity soul language wonder life human nature philosophy kant plato nietzsche experience perhaps sense belief".split(" ")
  ),
  journalism: new Set(
    "government policy minister ministry election officials official spokesperson reported report announced billion million percent bill law legislation court senate congress parliament president agency regulators economy market budget tax city council police public statement".split(" ")
  ),
}

export function detectDomain(p: PreparedText, topic?: string | null): { domain: DetectorDomain; source: "topic" | "content" } {
  const fromTopic = topic ? TOPIC_TO_DOMAIN[topic.trim().toLowerCase()] : undefined
  if (fromTopic) return { domain: fromTopic, source: "topic" }
  const toks = tokens(p.prose)
  if (!toks.length) return { domain: p.codeBlocks ? "programming" : "general", source: "content" }
  let best: DetectorDomain = "general"
  let bestScore = 0
  for (const [d, lex] of Object.entries(LEXICON) as [DetectorDomain, Set<string>][]) {
    let s = (toks.filter((t) => lex.has(t)).length / toks.length) * 1000
    if (d === "programming" && p.codeBlocks >= 2) s += 25
    if (s > bestScore) {
      best = d
      bestScore = s
    }
  }
  return { domain: bestScore >= 12 ? best : "general", source: "content" }
}
