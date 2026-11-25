import sanitizeHtml from "sanitize-html"

// Story HTML is written by authors and stored in Firestore, where anyone with the SDK can put raw
// markup that never went through the editor. Everything rendered with dangerouslySetInnerHTML goes
// through this allowlist first: only what the TipTap editor produces survives. Scripts, iframes,
// event handlers (onerror=…), inline styles beyond alignment/highlight colours, and javascript:/data:
// links are all dropped. Images load only from Prism's own uploads (Firebase Storage) or same-origin
// paths, so a story can't embed a third-party tracking pixel that logs every reader's IP.

const TEXT_ALIGN = [/^(left|right|center|justify)$/]
// Where the editor's uploads live (src/lib/storage.ts → getDownloadURL)
const IMAGE_ORIGINS = ["https://firebasestorage.googleapis.com/", "https://storage.googleapis.com/"]

/** An <img src> readers may load: Prism's Firebase Storage or a same-origin path */
export function isAllowedImageSrc(src: string | null | undefined): boolean {
  if (!src) return false
  // Browsers ignore tabs/newlines inside URLs, so "/<TAB>/evil.com" would load as //evil.com
  const u = src.replace(/[\u0000-\u0020\u007f]/g, "")
  if (u.startsWith("/")) return !u.startsWith("//") && !u.startsWith("/\\")
  return IMAGE_ORIGINS.some((origin) => u.startsWith(origin))
}

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)$/i, /^var\(--[\w-]+\)$/]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "strike", "del", "mark", "sub", "sup", "small",
    "code", "pre", "blockquote", "ul", "ol", "li",
    "a", "img", "figure", "figcaption", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    mark: ["data-color", "style"],
    code: ["class"],
    ol: ["start"],
    "*": ["style"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedStyles: {
    "*": { "text-align": TEXT_ALIGN },
    mark: { "background-color": COLOR, color: COLOR },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    // Every outbound link opens safely and passes no ranking credit for user content
    a: (tagName, attribs) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { target, rel, ...rest } = attribs
      const external = /^https?:/i.test(rest.href ?? "")
      return { tagName, attribs: external ? { ...rest, target: "_blank", rel: "noopener noreferrer nofollow ugc" } : rest }
    },
  },
  // Images from anywhere else are dropped entirely
  exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageSrc(frame.attribs.src),
}

/** Story HTML made safe to render */
export function sanitizeArticleHtml(html: string | null | undefined): string {
  if (!html) return ""
  return sanitizeHtml(html, OPTIONS)
}

/**
 * A user-supplied URL that is safe to put in an href: site-relative paths, http(s), mailto and tel.
 * Anything else (javascript:, data:, protocol-relative //host) comes back as undefined.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const u = url.trim()
  if (u.startsWith("/") && !u.startsWith("//") && !u.startsWith("/\\")) return u
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : undefined
}
