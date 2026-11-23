import type { NextConfig } from "next"

// Content-Security-Policy is set per request (with a nonce) in src/proxy.ts — see src/lib/csp.ts
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The editor's audiobook recorder and Dictate use the mic on our own origin; nothing needs camera or location
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Firebase signInWithPopup needs the popup to talk back to this window
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses are per-user or per-request: never cache them in shared caches
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ]
  },
  // Bottom-left belongs to the Dev Role Tester pill
  devIndicators: { position: "bottom-right" },
  images: {
    // Unsplash covers are resized by Unsplash's CDN via this loader; everything else passes through
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      // Firebase Storage uploads (avatars, article images) and Google account photos
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
