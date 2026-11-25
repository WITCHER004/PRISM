// Lexical plagiarism check against Prism's own published stories (Layer 1 of the hybrid pipeline;
// the ML engine adds MinHash/LSH and semantic paraphrase search on top, see ai_plagiarism_engine/).
//
// Per sentence of the submission's own prose (code and attributed quotes removed, see textPrep.ts):
// candidates are source sentences sharing a 5-word phrase; a sentence is flagged when >= 85% of its
// words appear, in order, in one source sentence — verbatim and lightly edited copying, including
// patchwork assembled from several stories. The score is the share of the submission's prose words
// in flagged sentences (0–100). It only knows Prism's corpus, so the UI says "overlap with Prism stories".

import { prepareText, tokens } from "./textPrep"
import type { FlaggedSentence, PlagiarismSourceMatch } from "./types"

const SHINGLE = 5
export const LEXICAL_OVERLAP = 0.85
const MIN_SENTENCE_WORDS = 8

export interface CorpusDoc {
  id: string
  title: string
  html: string
  /** Public path of the story, used as the match link */
  url?: string
}

export interface OverlapResult {
  /** 0–100: share of the submission's prose that matches a published story */
  percent: number
  closest?: { id: string; title: string; percent: number; url?: string }
  /** Stories compared against */
  compared: number
  flagged: FlaggedSentence[]
  matches: PlagiarismSourceMatch[]
}

function shingleKeys(toks: string[]): string[] {
  if (toks.length < SHINGLE) return toks.length ? [toks.join(" ")] : []
  const out: string[] = []
  for (let i = 0; i + SHINGLE <= toks.length; i++) out.push(toks.slice(i, i + SHINGLE).join(" "))
  return out
}

/** Share of q's tokens that appear in order in src (longest common subsequence / |q|) */
export function orderedOverlap(q: string[], src: string[]): number {
  if (!q.length || !src.length) return 0
  let prev = new Array<number>(src.length + 1).fill(0)
  for (let i = 1; i <= q.length; i++) {
    const cur = new Array<number>(src.length + 1).fill(0)
    for (let j = 1; j <= src.length; j++) cur[j] = q[i - 1] === src[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    prev = cur
  }
  return prev[src.length] / q.length
}

export function overlapWithCorpus(html: string, corpus: readonly CorpusDoc[], excludeId?: string): OverlapResult {
  const mine = prepareText(html).sentences.map((text) => ({ text, toks: tokens(text) }))
  const total = mine.reduce((a, s) => a + s.toks.length, 0)
  if (!total) return { percent: 0, compared: 0, flagged: [], matches: [] }

  // Which of my sentences own each phrase
  const owners = new Map<string, number[]>()
  mine.forEach((s, i) => {
    if (s.toks.length < MIN_SENTENCE_WORDS) return
    for (const k of shingleKeys(s.toks)) owners.set(k, [...(owners.get(k) ?? []), i])
  })

  const best: { overlap: number; doc: CorpusDoc; source: string }[] = new Array(mine.length)
  let compared = 0
  for (const doc of corpus) {
    if (doc.id === excludeId) continue
    compared++
    for (const sentence of prepareText(doc.html).sentences) {
      const st = tokens(sentence)
      const hit = new Set<number>()
      for (const k of shingleKeys(st)) owners.get(k)?.forEach((i) => hit.add(i))
      for (const i of hit) {
        const ov = orderedOverlap(mine[i].toks, st)
        if (!best[i] || ov > best[i].overlap) best[i] = { overlap: ov, doc, source: sentence }
      }
    }
  }

  const flagged: FlaggedSentence[] = []
  const perSource = new Map<string, { doc: CorpusDoc; words: number }>()
  let copied = 0
  mine.forEach((s, i) => {
    const b = best[i]
    if (!b || b.overlap < LEXICAL_OVERLAP) return
    copied += s.toks.length
    const agg = perSource.get(b.doc.id) ?? { doc: b.doc, words: 0 }
    agg.words += s.toks.length
    perSource.set(b.doc.id, agg)
    flagged.push({
      text: s.text,
      aiProbability: 0,
      plagiarismMatchUrl: b.doc.url,
      plagiarismMatchTitle: b.doc.title,
      plagiarismSimilarity: Math.round(b.overlap * 1000) / 1000,
      matchType: b.overlap >= 0.98 ? "VERBATIM" : "NEAR_VERBATIM",
      reason: `${b.overlap >= 0.98 ? "Copied verbatim from" : "Nearly identical to"} a sentence in “${b.doc.title}” (${Math.round(b.overlap * 100)}% of its words). Quote it with attribution or rewrite it.`,
    })
  })
  const pct = (w: number) => Math.round((w / total) * 1000) / 10
  const matches = [...perSource.values()]
    .sort((a, b) => b.words - a.words)
    .map((m) => ({ title: m.doc.title, url: m.doc.url, percent: pct(m.words) }))
  const top = [...perSource.values()].sort((a, b) => b.words - a.words)[0]
  return {
    percent: pct(copied),
    closest: top ? { id: top.doc.id, title: top.doc.title, percent: pct(top.words), url: top.doc.url } : undefined,
    compared,
    flagged,
    matches,
  }
}
