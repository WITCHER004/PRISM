// Plagiarism signal: how much of a submission's phrasing already appears in stories on Prism.
// Measured, not estimated: the share of the submission's 5-word phrases (shingles) found in another
// story. It only knows Prism's own corpus, so the UI labels it "overlap with Prism stories".

const SHINGLE = 5

function shingles(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + SHINGLE <= words.length; i++) out.add(words.slice(i, i + SHINGLE).join(" "))
  return out
}

export interface OverlapResult {
  /** 0–100: share of the submission's phrases that also appear in the closest story */
  percent: number
  closest?: { id: string; title: string; percent: number }
  /** Stories compared against */
  compared: number
}

export function overlapWithCorpus(
  html: string,
  corpus: readonly { id: string; title: string; html: string }[],
  excludeId?: string
): OverlapResult {
  const mine = shingles(html)
  if (mine.size === 0) return { percent: 0, compared: 0 }
  let best: OverlapResult["closest"]
  let compared = 0
  for (const doc of corpus) {
    if (doc.id === excludeId) continue
    compared++
    const theirs = shingles(doc.html)
    let shared = 0
    for (const s of mine) if (theirs.has(s)) shared++
    const percent = Math.round((shared / mine.size) * 1000) / 10
    if (!best || percent > best.percent) best = { id: doc.id, title: doc.title, percent }
  }
  return { percent: best?.percent ?? 0, closest: best && best.percent > 0 ? best : undefined, compared }
}
