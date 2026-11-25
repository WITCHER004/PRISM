import { linkifyContacts } from "@/lib/linkify"
import { sanitizeArticleHtml } from "@/lib/sanitize"
import { generateSlug } from "@/lib/utils"

import type { TocItem } from "@/components/posts/TableOfContents"

/** Author HTML is untrusted: allowlist it, linkify contacts, and give every h2 an anchor for the contents list */
export function renderArticleHtml(raw: string | null | undefined): { html: string; toc: TocItem[] } {
  return withHeadingIds(linkifyContacts(sanitizeArticleHtml(raw)))
}

export function withHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = []
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (match, attrs = "", inner: string) => {
    if (/\sid=/.test(attrs)) return match
    const text = inner.replace(/<[^<>]{0,2000}>/g, "").trim()
    let id = generateSlug(text) || `section-${toc.length + 1}`
    if (toc.some((t) => t.id === id)) id = `${id}-${toc.length + 1}`
    toc.push({ id, text })
    return `<h2${attrs} id="${id}">${inner}</h2>`
  })
  return { html: out, toc }
}
