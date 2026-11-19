// The article's "paragraphs": every block a reader can select or be anchored to. Margin notes, private
// highlights and reading progress all count blocks with this same selector, so their indexes agree.
export const PARAGRAPH_SELECTOR = "p, h1, h2, h3, blockquote, li"

export const paragraphsIn = (container: Element | null): Element[] =>
  container ? Array.from(container.querySelectorAll(PARAGRAPH_SELECTOR)) : []

/** Index of the block containing `node`, or -1 */
export function paragraphIndexOf(container: Element, node: Node | null): number {
  const el = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element))
  const block = el?.closest(PARAGRAPH_SELECTOR)
  return block ? paragraphsIn(container).indexOf(block) : -1
}

/** Scroll so the block sits a little below the sticky header. Returns false if there's no such block. */
export function scrollToParagraph(container: Element | null, index: number, behavior: ScrollBehavior = "smooth"): boolean {
  const el = paragraphsIn(container)[index] as HTMLElement | undefined
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - 120
  window.scrollTo({ top: Math.max(0, top), behavior })
  return true
}

/** `#para-12` → 12 (the deep link the highlight vault uses), else null */
export function paragraphFromHash(hash: string): number | null {
  const m = /^#para-(\d+)$/.exec(hash)
  return m ? Number(m[1]) : null
}

/** How far through the container the reader is (0–100), and the block at the reading line */
export function readingPosition(container: Element): { percent: number; paragraphIndex: number } {
  const rect = container.getBoundingClientRect()
  const vh = window.innerHeight
  const travel = rect.height - vh
  const raw = travel <= 0 ? (rect.bottom <= vh ? 100 : 0) : (-rect.top / travel) * 100
  const percent = Math.round(Math.min(100, Math.max(0, raw)))

  // The first block whose bottom is below a reading line a quarter of the way down the screen
  const line = vh * 0.25
  const blocks = paragraphsIn(container)
  let paragraphIndex = 0
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].getBoundingClientRect().bottom > line) {
      paragraphIndex = i
      break
    }
    paragraphIndex = i
  }
  return { percent, paragraphIndex }
}
