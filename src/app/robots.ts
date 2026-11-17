import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/seo"

const PRIVATE = [
  "/admin",
  "/panel",
  "/auth",
  "/login",
  "/signup",
  "/dashboard",
  "/editor",
  "/settings",
  "/bookmarks",
  "/profile",
  "/review-dashboard",
  "/submissions",
  "/search",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/og"], // social-card crawlers honour robots.txt, so OG images must stay reachable
      // Signed-in tools and thin search results: nothing a searcher should land on. Writer profiles
      // live at the top level too (/editorial, /profilepics…), so match each route exactly or as a folder.
      disallow: [
        "/api/",
        ...PRIVATE.flatMap((r) => [`${r}$`, `${r}?`, `${r}/`]),
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  }
}
