// Turns plain-text emails and phone numbers in story HTML into mailto:/tel: links.
// Only touches text between tags, and never inside an existing link, code or pre block.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// +44 20 7946 0958, (555) 123-4567, 555.123.4567. Needs separators, so years and plain numbers don't match.
const PHONE = /(?<![\w+])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}(?![\w-])/g

const SKIP = new Set(["a", "code", "pre", "script", "style"])

function linkText(text: string): string {
  return text
    .replace(EMAIL, (m) => `<a href="mailto:${m}">${m}</a>`)
    .replace(/(^|>)([^<]*)/g, (_all, lead: string, rest: string) =>
      lead + rest.replace(PHONE, (m) => `<a href="tel:${m.replace(/[^\d+]/g, "")}">${m}</a>`)
    )
}

export function linkifyContacts(html: string): string {
  let depth = 0
  return html.replace(/(<\/?([a-zA-Z0-9]+)[^>]*>)|([^<]+)/g, (all, tag: string, name: string, text: string) => {
    if (tag) {
      if (SKIP.has(name.toLowerCase()) && !tag.endsWith("/>")) depth += tag.startsWith("</") ? -1 : 1
      if (depth < 0) depth = 0
      return all
    }
    return depth ? text : linkText(text)
  })
}
