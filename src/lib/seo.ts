import type { Metadata } from "next"

// The deployed site. Never point this at a domain we don't own: canonicals, the sitemap,
// robots.txt, OG images and structured data are all built from it.
const DEFAULT_SITE_URL = "https://prism0.netlify.app"

function getSiteUrl() {
  // NEXT_PUBLIC_SITE_URL wins; otherwise Netlify's build-time `URL` (the site's primary address).
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL
  if (!configuredUrl) return new URL(DEFAULT_SITE_URL)

  let url: URL
  try {
    url = new URL(configuredUrl)
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.")
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  const isLocalhost =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)

  return isLocalhost ? new URL(DEFAULT_SITE_URL) : new URL(url.origin)
}

export const SITE_URL = getSiteUrl()

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}

export function socialImageUrl(title: string, description: string) {
  const imageUrl = new URL("/api/og", SITE_URL)
  imageUrl.searchParams.set("title", title.slice(0, 100))
  imageUrl.searchParams.set("description", description.slice(0, 180))
  return imageUrl.toString()
}

/** The site's host for display, e.g. "prism0.netlify.app". */
export const SITE_HOST = SITE_URL.host

/**
 * Complete metadata for a page: title, description, canonical, and matching Open Graph +
 * Twitter cards with a generated image. `socialTitle` overrides the share title (the page
 * title gets "| Prism" from the layout template; shares should read naturally on their own).
 */
export function pageMetadata({
  title,
  description,
  path,
  socialTitle,
  type = "website",
  noindex = false,
}: {
  title: string
  description: string
  path: string
  socialTitle?: string
  type?: "website" | "article" | "profile"
  noindex?: boolean
}): Metadata {
  const share = socialTitle ?? `${title} | Prism`
  const image = { url: socialImageUrl(share, description), width: 1200, height: 630, alt: share }
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: "Prism", url: path, title: share, description, images: [image] },
    twitter: { card: "summary_large_image", title: share, description, images: [image] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

/** schema.org BreadcrumbList for a trail like Home › Explore › Design. */
export function breadcrumbList(trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

/** One line per topic for meta descriptions and topic headers (120–155 chars). */
export const TOPIC_DESCRIPTIONS: Record<string, string> = {
  infrastructure:
    "Essays on distributed systems, databases, reliability and the infrastructure that keeps software running, from engineers who operate it.",
  policy:
    "Independent writing on tech policy, regulation, AI governance and the lobbying behind the rules, from reporters and policy practitioners.",
  design:
    "Essays on product design, design systems, typography and colour: how good interfaces get made, written by the designers making them.",
  science:
    "Science writing for curious readers: climate records, physics, biology and how research really works, explained by people close to it.",
  reporting:
    "Original reporting and long-form journalism from independent writers: investigations, field notes and stories the feeds don't surface.",
  philosophy:
    "Philosophy essays on ethics, technology, attention and how to live with it, from independent thinkers writing beyond the academy.",
  climate:
    "Climate writing grounded in data: ice cores, energy, adaptation and policy, from scientists and journalists covering a warming planet.",
  craft:
    "On the craft of making things well: writing, building, editing and the habits behind durable work, from practitioners who do it daily.",
  programming:
    "Programming essays on languages, architecture, testing and long-lived codebases, from working engineers sharing what they've learned.",
  culture:
    "Essays on internet culture, media, books and how technology shapes the way we live, read and pay attention, from independent writers.",
}

export function truncateDescription(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}
