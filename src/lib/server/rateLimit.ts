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

/** The caller's IP: the platform's own header first (not client-settable), then the usual proxies */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ?? // Netlify
    headers.get("fastly-client-ip") ?? // Firebase Hosting (Fastly)
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  )
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
