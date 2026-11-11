import type { FlaggedPassage, Phase1Signal } from "./types"

/**
 * Heuristic AI-text detector. No model, no network: it measures surface statistics that
 * differ between typical human prose and typical LLM output.
 *
 *  - Burstiness:     humans mix short and long sentences; LLM sentences are uniform in length.
 *  - Perplexity:     without a language model we approximate predictability by the density
 *                    of formulaic word sequences ("in order to", "plays a key role in", ...).
 *  - Repetition:     repeated word trigrams and stock transition openers ("Moreover, ...").
 *  - Stock phrasing: vocabulary LLMs over-use ("delve", "tapestry", "ever-evolving", ...).
 *  - Voice:          contractions, first person, questions, concrete numbers and asides,
 *                    which human writers use far more often.
 *
 * Each signal maps to an AI-likelihood in [0, 1]. The text is scored in passages (~60+ words),
 * and the AI share is the word-weighted mean of passage scores — i.e. "how much of this text
 * reads as machine-written". It is a screening tool, not proof; Phase 2 is a human review.
 */

const WEIGHTS: Record<Phase1Signal["key"], number> = {
  burstiness: 0.25,
  perplexity: 0.2,
  repetition: 0.15,
  stockPhrasing: 0.25,
  voice: 0.15,
}

const SIGNAL_LABEL: Record<Phase1Signal["key"], string> = {
  burstiness: "Burstiness",
  perplexity: "Perplexity (predictability)",
  repetition: "Repetitive phrasing",
  stockPhrasing: "Stock AI phrasing",
  voice: "Personal voice",
}

// Vocabulary and constructions that are markedly over-represented in LLM output
const STOCK_PHRASES = [
  "delve", "delves", "delving", "tapestry", "testament to", "ever-evolving", "ever-changing",
  "fast-paced world", "in today's world", "in today’s world", "in today's digital", "in today’s digital",
  "navigate the complexities", "navigating the complexities", "realm of", "in the realm",
  "it's important to note", "it’s important to note", "it is important to note", "it is worth noting",
  "embark on", "embarking on", "unlock the", "unlocking the", "unleash", "game-changer", "game changer",
  "seamless", "seamlessly", "leverage", "leveraging", "robust", "pivotal", "paramount", "multifaceted",
  "holistic", "synergy", "cutting-edge", "transformative", "foster", "fostering", "underscore",
  "underscores", "showcasing", "a myriad of", "plethora", "intricacies",
  "landscape of", "the landscape", "elevate", "revolutionize", "resonate", "harness the power",
  "in conclusion", "to sum up", "in summary", "ultimately,", "at the end of the day",
  "a crucial role", "a vital role", "a key role", "a significant role", "stands as", "serves as a",
  "not only", "but also", "whether you're", "whether you are", "dive into", "dive deep",
  "let's explore", "let us explore", "comprehensive guide", "key takeaways", "rich tapestry",
]

// Formulaic connectors and collocations: a cheap stand-in for low perplexity
const FORMULAIC = [
  "in order to", "as well as", "a variety of", "a wide range of", "a range of", "in addition",
  "due to the", "it is essential", "it is crucial", "it is important", "is essential for",
  "is crucial for", "plays a", "role in", "one of the most", "the importance of", "ensure that",
  "allows for", "allowing for", "can help", "can be used", "helps to", "in terms of",
  "when it comes to", "on the other hand", "as a result", "for example,", "such as",
  "the ability to", "the potential to", "has the potential", "aims to", "designed to",
  "contribute to", "contributes to", "a deeper understanding", "better understanding",
  "significant impact", "a significant", "various aspects", "overall,", "additionally,",
  "furthermore,", "moreover,", "consequently,", "therefore,", "thus,",
]

const TRANSITION_OPENERS = new Set([
  "furthermore", "moreover", "additionally", "however", "overall", "ultimately", "consequently",
  "therefore", "thus", "importantly", "notably", "similarly", "conversely", "in", "firstly",
  "secondly", "lastly", "finally", "indeed",
])

const STOPWORDS = new Set(
  "the a an and or but of to in on for with at by from as is are was were be been it this that these those its their there his her our your my we you they i he she not no so than then".split(" ")
)

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

function words(text: string) {
  return text.toLowerCase().match(/[a-z0-9’']+(?:-[a-z0-9]+)*/g) ?? []
}

export function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])["”’)]?\s+(?=["“‘(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0)
}

function countOccurrences(haystack: string, needles: string[]) {
  let n = 0
  for (const needle of needles) {
    // Word-bounded match so "foster" doesn't hit "fostered"-like noise twice
    const re = new RegExp(`(?<![a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "g")
    n += haystack.match(re)?.length ?? 0
  }
  return n
}

type SignalValues = Record<Phase1Signal["key"], { ai: number; value: number; detail: string }>

/** Measure every signal on one stretch of text */
function measure(text: string): SignalValues {
  const lower = text.toLowerCase()
  const w = words(text)
  const n = Math.max(1, w.length)
  const per100 = (count: number) => (count / n) * 100
  const sentences = splitSentences(text)
  const lengths = sentences.map((s) => words(s).length)

  // Burstiness: coefficient of variation of sentence length
  let cv = 0.45
  if (lengths.length >= 3) {
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length)
    cv = mean ? sd / mean : 0
  }
  const burstAi = lengths.length >= 3 ? clamp01((0.6 - cv) / 0.32) : 0.4

  // Perplexity proxy: formulaic sequences per 100 words
  const formulaic = per100(countOccurrences(lower, FORMULAIC))
  const perplexityAi = clamp01((formulaic - 0.6) / 3.2)

  // Repetition: repeated content trigrams + transition-word sentence openers
  const trigrams = new Map<string, number>()
  for (let i = 0; i + 2 < w.length; i++) {
    const tri = w.slice(i, i + 3)
    if (tri.every((t) => STOPWORDS.has(t))) continue
    const key = tri.join(" ")
    trigrams.set(key, (trigrams.get(key) ?? 0) + 1)
  }
  let repeated = 0
  for (const c of trigrams.values()) if (c > 1) repeated += c - 1
  const repRatio = repeated / Math.max(1, w.length - 2)
  const openers = sentences.map((s) => words(s)[0] ?? "").filter(Boolean)
  const transitionShare = openers.length ? openers.filter((o) => TRANSITION_OPENERS.has(o)).length / openers.length : 0
  const repetitionAi = clamp01(repRatio * 8 + Math.max(0, transitionShare - 0.08) * 2.5)

  // Stock AI vocabulary per 100 words
  const stock = per100(countOccurrences(lower, STOCK_PHRASES))
  const stockAi = clamp01(stock / 1.6)

  // Voice: markers of a person writing
  const contractions = per100(text.match(/\b[A-Za-z]+[’'](?:t|s|re|ve|ll|d|m)\b/g)?.length ?? 0)
  const firstPerson = per100(w.filter((t) => t === "i" || t === "my" || t === "me" || t === "i’m" || t === "i'm").length)
  const questions = sentences.length ? sentences.filter((s) => /\?["”’)]?$/.test(s)).length / sentences.length : 0
  const specifics = per100(text.match(/\d|[()]|—|–|;/g)?.length ?? 0)
  const voiceScore = clamp01(contractions * 0.28 + firstPerson * 0.12 + questions * 1.5 + specifics * 0.18)
  const voiceAi = 1 - voiceScore

  return {
    burstiness: {
      ai: burstAi,
      value: round(cv),
      detail:
        lengths.length < 3
          ? "Too few sentences to judge rhythm."
          : `Sentence length varies by ${Math.round(cv * 100)}% (human prose is usually 50%+).`,
    },
    perplexity: {
      ai: perplexityAi,
      value: round(formulaic),
      detail: `${round(formulaic, 1)} formulaic phrases per 100 words.`,
    },
    repetition: {
      ai: repetitionAi,
      value: round(repRatio * 100, 1),
      detail: `${round(repRatio * 100, 1)}% repeated phrasing; ${Math.round(transitionShare * 100)}% of sentences open with a stock transition.`,
    },
    stockPhrasing: {
      ai: stockAi,
      value: round(stock, 1),
      detail: `${round(stock, 1)} stock AI phrases per 100 words.`,
    },
    voice: {
      ai: voiceAi,
      value: round(voiceScore),
      detail: `Contractions ${round(contractions, 1)}/100 words, first person ${round(firstPerson, 1)}/100, questions ${Math.round(questions * 100)}%.`,
    },
  }
}

function combine(v: SignalValues) {
  let p = 0
  for (const k of Object.keys(WEIGHTS) as Phase1Signal["key"][]) p += WEIGHTS[k] * v[k].ai
  // Sharpen around 0.45 so clearly-human passages score near 0 and clearly-AI ones near 1
  return 1 / (1 + Math.exp(-(p - 0.45) * 11))
}

/** Group paragraphs into passages of at least ~60 words so each has enough text to measure */
export function toPassages(text: string, minWords = 60) {
  const paragraphs = text.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  let buf = ""
  for (const p of paragraphs) {
    buf = buf ? `${buf}\n${p}` : p
    if (words(buf).length >= minWords) {
      out.push(buf)
      buf = ""
    }
  }
  if (buf) {
    if (out.length && words(buf).length < minWords / 2) out[out.length - 1] += `\n${buf}`
    else out.push(buf)
  }
  return out
}

export interface HeuristicResult {
  /** 0..1 word-weighted share judged machine-written */
  aiProbability: number
  wordCount: number
  signals: Phase1Signal[]
  flagged: FlaggedPassage[]
}

export function analyzeHeuristically(text: string): HeuristicResult {
  const all = words(text)
  if (all.length === 0) return { aiProbability: 0, wordCount: 0, signals: [], flagged: [] }

  const passages = toPassages(text)
  let weighted = 0
  const scored = passages.map((p) => {
    const pw = words(p).length
    const prob = combine(measure(p))
    weighted += prob * pw
    return { p, pw, prob }
  })
  const aiProbability = weighted / all.length

  // Document-level signals for the report
  const doc = measure(text)
  const signals: Phase1Signal[] = (Object.keys(WEIGHTS) as Phase1Signal["key"][]).map((key) => ({
    key,
    label: SIGNAL_LABEL[key],
    aiLikelihood: round(doc[key].ai),
    value: doc[key].value,
    detail: doc[key].detail,
  }))

  const flagged = scored
    .filter((s) => s.prob >= 0.5)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5)
    .map((s) => ({
      excerpt: s.p.length > 220 ? `${s.p.slice(0, 217).trimEnd()}…` : s.p,
      aiLikelihood: round(s.prob),
    }))

  return { aiProbability: clamp01(aiProbability), wordCount: all.length, signals, flagged }
}
