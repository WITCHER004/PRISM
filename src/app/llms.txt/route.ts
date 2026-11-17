import { getFeedPosts } from "@/actions/posts"
import { MOCK_TAGS } from "@/lib/data"
import { absoluteUrl } from "@/lib/seo"

export const revalidate = 3600

// llms.txt (https://llmstxt.org): a plain-Markdown map of the site for AI agents and answer engines.
// Built from the site URL so it can never point at another domain.
export async function GET() {
  const posts = (await getFeedPosts(50)).filter((p) => p.status === "PUBLISHED")
  const u = absoluteUrl

  const body = `# Prism

> Independent writing for curious readers. Discover stories across topics and follow the writers you value.

Prism is a publishing platform demo. The site includes sample writers and stories; memberships and payouts shown in the interface are not live financial services.

## Public pages

- [Home](${u("/")}): Featured stories and writers.
- [Explore](${u("/explore")}): Browse stories by topic.
- [About](${u("/about")}): How Prism is designed to work.
- [Elite for writers](${u("/elite")}): Paid views and peer review, simulated in the demo.
- [Membership](${u("/membership")}): Membership options shown in the demo.
- [XML sitemap](${u("/sitemap.xml")})

## Topics

${MOCK_TAGS.map((t) => `- [${t.name}](${u(`/explore/${t.slug}`)})`).join("\n")}

## Stories

${posts.map((p) => `- [${p.title}](${u(`/${p.author.username}/${p.slug}`)}): by ${p.author.displayName}`).join("\n")}

## Policies

- [Terms of Service](${u("/terms")})
- [Privacy Policy](${u("/privacy")})
- [Content Policy](${u("/content-policy")})

The legal pages are illustrative placeholders, not binding agreements or final policies. Membership checkout is simulated and does not take payments.

Only publicly published stories and public writer profiles should be treated as public content. Drafts and browser-local story previews are not published.
`

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
