// Content-Security-Policy, set per request by src/proxy.ts with a fresh nonce.
//
// No 'unsafe-inline' scripts: Next.js stamps the nonce on every script it emits (framework, page
// bundles, its inline bootstrap data) and our one inline script (the theme bootstrap in app/layout.tsx)
// reads it from the x-nonce header. 'strict-dynamic' lets those trusted scripts load what they need
// (Firebase Auth's apis.google.com loader, Analytics, reCAPTCHA for App Check); the host list is the
// fallback for older browsers. Nonces require every page to render per request, so the root layout
// reads headers() — see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
// Styles keep 'unsafe-inline' (Tailwind, motion's inline transforms); styles can't run code.

const isDev = process.env.NODE_ENV !== "production"

function supabaseOrigin() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    return url && !url.includes("your-project-ref") ? new URL(url).origin : ""
  } catch {
    return ""
  }
}

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      isDev ? "'unsafe-eval'" : "",
      "https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.recaptcha.net",
    ]
      .filter(Boolean)
      .join(" "),
    "style-src 'self' 'unsafe-inline'",
    // Only known image hosts, so injected markup can't load a tracking pixel: Firebase Storage
    // (uploads, avatars, covers), Google/GitHub profile photos, DiceBear fallback avatars, Unsplash
    // (next.config.ts image hosts) and Google Analytics' measurement pixels
    [
      "img-src 'self' data: blob:",
      "https://firebasestorage.googleapis.com https://storage.googleapis.com",
      "https://*.googleusercontent.com https://avatars.githubusercontent.com",
      "https://api.dicebear.com https://images.unsplash.com",
      "https://*.google-analytics.com https://*.googletagmanager.com https://www.google.com",
    ].join(" "),
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      "https://*.googleapis.com",
      "https://*.firebaseio.com wss://*.firebaseio.com",
      "https://*.firebaseapp.com",
      "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
      "https://www.google.com/recaptcha/ https://www.recaptcha.net",
      supabaseOrigin(),
      isDev ? "ws://localhost:* http://localhost:*" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "frame-src 'self' https://*.firebaseapp.com https://*.web.app https://accounts.google.com https://apis.google.com https://www.google.com/recaptcha/ https://recaptcha.google.com https://www.recaptcha.net",
    "worker-src 'self' blob:",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

/** API responses are JSON: they never need to load or run anything */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'"

export function newNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
