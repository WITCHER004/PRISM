// Fixed-window rate limiter for the API, keyed by client IP and route group.
//
// In memory, so it's per server instance: it stops a single client from hammering an instance, which
// covers casual abuse and runaway scripts. For a hard global limit across instances, back this with a
// shared store (Upstash Redis, Firestore counters) — see SECURITY notes in the audit summary.

interface Rule {
  limit: number
  windowMs: number
}

// Most specific prefix wins. Expensive or abusable endpoints get tight budgets.
const RULES: [prefix: string, rule: Rule][] = [
  ["/api/moderation/analyze", { limit: 10, windowMs: 60_000 }], // AI detection: external API quota
  ["/api/profile/avatar", { limit: 10, windowMs: 60_000 }], // image uploads
  ["/api/elite/checkout", { limit: 10, windowMs: 60_000 }],
  ["/api/earnings/payouts", { limit: 5, windowMs: 60_000 }],
  ["/api/articles/", { limit: 30, windowMs: 60_000 }], // submit, votes, counters, views
  ["/api/read-session", { limit: 60, windowMs: 60_000 }],
  ["/api/og", { limit: 60, windowMs: 60_000 }], // image rendering is CPU-heavy
  ["/api/", { limit: 120, windowMs: 60_000 }],
]

const buckets = new Map<string, { count: number; resetAt: number }>()
let lastSweep = 0

function ruleFor(path: string): [string, Rule] {
  return RULES.find(([prefix]) => path.startsWith(prefix)) ?? RULES[RULES.length - 1]
}

/**
 * The caller's IP, read only from a header the hosting platform sets (audit F-09). Proxy headers such as
 * x-forwarded-for, x-real-ip or fastly-client-ip are client-settable unless the platform overwrites them,
 * so trusting "the first one present" lets a client pick its own rate-limit key.
 *
 * - TRUSTED_IP_HEADER (env) names the header explicitly; set it for any host not detected below.
 * - Netlify (NETLIFY / NETLIFY_DEV): x-nf-client-connection-ip, which Netlify's edge always overwrites.
 * - Google Cloud (Cloud Run / Cloud Functions / Firebase App Hosting: K_SERVICE or FUNCTION_TARGET): the
 *   LAST x-forwarded-for entry. Google's front end appends the address it received the connection from,
 *   so the last entry is the real peer while anything earlier came from the client and may be forged.
 *   Never use the first entry. Behind another proxy layer (e.g. a Firebase Hosting rewrite or a load
 *   balancer that also appends) the last entry is that proxy, so set TRUSTED_IP_HEADER for such setups.
 * - Otherwise (local dev): "local", one shared bucket.
 */
export function clientIp(headers: Headers): string {
  const named = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase()
  if (named) {
    const v = headers.get(named)
    if (!v) return "unknown"
    // If the named header is a list (x-forwarded-for style), the platform's own entry is the last one
    return v.split(",").pop()!.trim() || "unknown"
  }
  if (process.env.NETLIFY || process.env.NETLIFY_DEV) return headers.get("x-nf-client-connection-ip")?.trim() || "unknown"
  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET) {
    const last = headers.get("x-forwarded-for")?.split(",").pop()?.trim()
    return last || "unknown"
  }
  return "local"
}

export type RateResult = { ok: true; remaining: number; limit: number } | { ok: false; retryAfter: number; limit: number }

export function checkRateLimit(path: string, key: string, now = Date.now()): RateResult {
  const [group, rule] = ruleFor(path)
  // Occasionally drop expired windows so the map can't grow without bound
  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const id = `${group}|${key}`
  let b = buckets.get(id)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + rule.windowMs }
    buckets.set(id, b)
  }
  b.count++
  if (b.count > rule.limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000), limit: rule.limit }
  return { ok: true, remaining: rule.limit - b.count, limit: rule.limit }
}

/** In-memory fixed window for an arbitrary key (per instance) */
export function checkKeyLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000), limit }
  return { ok: true, remaining: limit - b.count, limit }
}
