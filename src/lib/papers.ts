// Advanced Papers: long-form research pieces that only Prism Elite members read in full.
// Everyone sees the title, the abstract (key takeaways) and the opening quarter.

export type PaperDepth = "deep-dive" | "synthesis" | "monograph"

export interface AdvancedPaper {
  isAdvancedPaper: true
  requiredTier: "elite"
  depth: PaperDepth
  /** Exactly three, shown to every reader as the abstract */
  takeaways: string[]
}

export const PAPER_DEPTHS: { value: PaperDepth; label: string; desc: string }[] = [
  { value: "deep-dive", label: "Technical Deep-Dive", desc: "Implementation detail, code and benchmarks." },
  { value: "synthesis", label: "Research Synthesis", desc: "Draws many primary sources into one argument." },
  { value: "monograph", label: "Peer-Reviewed Monograph", desc: "A complete study, checked by the peer panel." },
]

export const depthLabel = (d: PaperDepth) => PAPER_DEPTHS.find((x) => x.value === d)?.label ?? "Advanced Paper"

/** Share of the paper's blocks a non-member can read */
export const PAPER_PREVIEW_FRACTION = 0.25

/** Close reading runs slower than the 238 wpm used for ordinary read times */
export const deepReadMinutes = (words: number) => Math.max(1, Math.round(words / 150))

export const newPaper = (): AdvancedPaper => ({
  isAdvancedPaper: true,
  requiredTier: "elite",
  depth: "deep-dive",
  takeaways: ["", "", ""],
})

/** A paper is only publishable as one when all three takeaways are written */
export const paperIsComplete = (p?: AdvancedPaper) => !p || p.takeaways.every((t) => t.trim().length > 0)

/** Fade over a locked paper's preview */
export const PAPER_MASK = "linear-gradient(to bottom, black 40%, transparent 100%)"
