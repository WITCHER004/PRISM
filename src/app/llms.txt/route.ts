import { getPublishedPosts } from "@/lib/server/content"
import { TOPICS } from "@/lib/topics"
import { absoluteUrl } from "@/lib/seo"

// Reads live Firestore (uncached fetch), so it renders per request
export const dynamic = "force-dynamic"

// llms.txt (https://llmstxt.org): a plain-Markdown map of the site for AI agents and answer engines.
// Built from the site URL so it can never point at another domain.
export async function GET() {
  const posts = (await getPublishedPosts()).slice(0, 200)
  const u = absoluteUrl

  const body = `# Prism

> Independent writing for curious readers. Discover stories across topics and follow the writers you value.

Prism is a publishing platform for independent writers. Every story listed here was published by a member and passed Prism's review. Memberships and payouts shown in the interface are not live financial services.

## Public pages

- [Home](${u("/")}): Featured stories and writers.
- [Explore](${u("/explore")}): Browse stories by topic.
- [About](${u("/about")}): How Prism is designed to work.
- [Elite for writers](${u("/elite")}): Paid views and peer review, simulated in the demo.
- [Membership](${u("/membership")}): Membership options shown in the demo.
- [XML sitemap](${u("/sitemap.xml")})

## Topics

${TOPICS.map((t) => `- [${t.name}](${u(`/explore/${t.slug}`)})`).join("\n")}

## Stories

${posts.map((p) => `- [${p.title}](${u(`/${p.author.username}/${p.slug}`)}): by ${p.author.displayName}`).join("\n")}

## Policies

- [Terms of Service](${u("/terms")})
- [Privacy Policy](${u("/privacy")})
- [Content Policy](${u("/content-policy")})

The legal pages are illustrative placeholders, not binding agreements or final policies. Membership checkout is simulated and does not take payments.

Only publicly published stories and public writer profiles should be treated as public content. Drafts and stories still under review are not published.
`

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
