const DEFAULT_SITE_URL = "https://prism.pub"

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL
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

export function truncateDescription(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}
