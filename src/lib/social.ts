// Social handles: validation, normalization, profile links and share text.
// Isomorphic — used by the profile form, the profile hub and the share modal.

export type SocialKey = "linkedinHandle" | "instagramHandle" | "twitterHandle" | "githubHandle"

export interface SocialHandles {
  linkedinHandle?: string
  instagramHandle?: string
  twitterHandle?: string
  githubHandle?: string
  websiteUrl?: string
}

export const SOCIALS: Record<
  SocialKey,
  { label: string; short: string; prefix: string; placeholder: string; pattern: RegExp; hint: string; url: (h: string) => string; strip: RegExp }
> = {
  linkedinHandle: {
    label: "LinkedIn",
    short: "LinkedIn",
    prefix: "in/",
    placeholder: "your-name",
    pattern: /^[A-Za-z0-9-]{3,100}$/,
    hint: "Letters, numbers and dashes — the part after linkedin.com/in/.",
    url: (h) => `https://www.linkedin.com/in/${h}`,
    strip: /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/|^in\//i,
  },
  instagramHandle: {
    label: "Instagram",
    short: "IG",
    prefix: "@",
    placeholder: "handle",
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    hint: "Letters, numbers, dots and underscores, up to 30.",
    url: (h) => `https://www.instagram.com/${h}`,
    strip: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/|^@/i,
  },
  twitterHandle: {
    label: "X / Twitter",
    short: "X",
    prefix: "@",
    placeholder: "handle",
    pattern: /^[A-Za-z0-9_]{1,15}$/,
    hint: "Letters, numbers and underscores, up to 15.",
    url: (h) => `https://x.com/${h}`,
    strip: /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/|^@/i,
  },
  githubHandle: {
    label: "GitHub",
    short: "GitHub",
    prefix: "github.com/",
    placeholder: "username",
    pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/,
    hint: "Letters, numbers and dashes, up to 39.",
    url: (h) => `https://github.com/${h}`,
    strip: /^(?:https?:\/\/)?(?:www\.)?github\.com\/|^@/i,
  },
}

export const SOCIAL_KEYS = Object.keys(SOCIALS) as SocialKey[]

/** Accepts a bare handle, "@handle" or a pasted profile URL; returns the bare handle */
export function normalizeHandle(key: SocialKey, raw: string) {
  return raw.trim().replace(SOCIALS[key].strip, "").replace(/[/?#].*$/, "").trim()
}

export function handleError(key: SocialKey, raw: string) {
  const h = normalizeHandle(key, raw)
  if (!h) return undefined
  return SOCIALS[key].pattern.test(h) ? undefined : SOCIALS[key].hint
}

export function socialLinks(h: SocialHandles) {
  return SOCIAL_KEYS.flatMap((key) => {
    const v = h[key] && normalizeHandle(key, h[key]!)
    if (!v) return []
    const label = key === "linkedinHandle" ? `in/${v}` : key === "githubHandle" ? `github/${v}` : `@${v}`
    return [{ key, network: SOCIALS[key].label, label, href: SOCIALS[key].url(v) }]
  })
}

/** "Connect with me on LinkedIn: linkedin.com/in/x | IG: @y | X: @z" — empty if no handles */
export function handlesLine(h: SocialHandles, opts: { firstPerson: boolean }) {
  const parts: string[] = []
  const li = h.linkedinHandle && normalizeHandle("linkedinHandle", h.linkedinHandle)
  const ig = h.instagramHandle && normalizeHandle("instagramHandle", h.instagramHandle)
  const x = h.twitterHandle && normalizeHandle("twitterHandle", h.twitterHandle)
  if (li) parts.push(`LinkedIn: linkedin.com/in/${li}`)
  if (ig) parts.push(`IG: @${ig}`)
  if (x) parts.push(`X: @${x}`)
  if (!parts.length) return ""
  return `${opts.firstPerson ? "Connect with me on" : "Follow the author on"} ${parts.join(" | ")}`
}

export interface ShareInput {
  title: string
  url: string
  authorName: string
  handles: SocialHandles
  /** True when the author is sharing their own article */
  asAuthor: boolean
}

export function shareText({ title, url, authorName, handles, asAuthor }: ShareInput) {
  const lead = asAuthor ? `Read my latest article: “${title}”` : `Read “${title}” by ${authorName}`
  const line = handlesLine(handles, { firstPerson: asAuthor })
  return [`${lead} — ${url}`, line].filter(Boolean).join("\n")
}

/** X has a 280-character limit (links count as 23), so it gets a compact version */
export function shareTextForX({ title, authorName, handles, asAuthor }: ShareInput) {
  const x = handles.twitterHandle && normalizeHandle("twitterHandle", handles.twitterHandle)
  const lead = asAuthor ? `Read my latest article: “${title}”` : `Read “${title}” by ${x ? `@${x}` : authorName}`
  const tail = asAuthor && x ? ` — follow @${x}` : ""
  const max = 280 - 24 - tail.length
  return (lead.length > max ? `${lead.slice(0, max - 1)}…` : lead) + tail
}

export function shareUrls(input: ShareInput) {
  const text = shareText(input)
  return {
    linkedin: `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
    x: `https://x.com/intent/tweet?text=${encodeURIComponent(shareTextForX(input))}&url=${encodeURIComponent(input.url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
  }
}

/** Instagram has no web share intent: a caption to paste, with the link spelled out */
export function instagramCaption(input: ShareInput) {
  const ig = input.handles.instagramHandle && normalizeHandle("instagramHandle", input.handles.instagramHandle)
  const lead = input.asAuthor ? `New article: “${input.title}”` : `Reading “${input.title}” by ${ig ? `@${ig}` : input.authorName}`
  return [lead, `Link in bio, or read it here: ${input.url}`, handlesLine(input.handles, { firstPerson: input.asAuthor })]
    .filter(Boolean)
    .join("\n\n")
}
