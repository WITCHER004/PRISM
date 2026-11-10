# SEO Audit: Prism (local development site)

**Target:** `http://localhost:3000`
**Audit date:** 2026-11-10
**Method:** Manual browser and source inspection. The bundled SEO runtime was not ready, so this is not a full Lighthouse, field-data, backlink, or search-index audit.
**Scope:** 33 distinct internal links discovered from the homepage; all returned HTTP 200. Twenty representative routes were checked directly. The unknown route `/does-not-exist` returned HTTP 404.

## Executive summary

**Baseline SEO readiness score: 53/100 before remediation.** This was a manually assessed, category-weighted checklist score, not a Lighthouse score or search ranking prediction. It has not been recalculated. The code changes below address the technical findings; production indexing and performance still need external validation.

The initial gaps in crawler discovery, canonicals, social previews, structured data, and private-route indexation have been addressed. A local production build was served and smoke-tested; this does not establish behavior on the deployed production host. Search visibility and Core Web Vitals cannot be verified against localhost.

## Findings

### High

1. **Resolved — crawler discovery files.** The app now serves `/robots.txt` and `/sitemap.xml`; the sitemap is refreshed hourly and includes public pages, topics, profiles, and published stories. `/llms.txt` is also present. The sitemap uses the production origin rather than localhost.

### Medium

2. **Resolved — canonicals.** The homepage, public articles, profiles, topics, and static public pages now emit canonical URLs based on the production origin. The local production smoke test confirmed the homepage and article canonicals.

3. **Resolved — duplicate title suffixes.** Child titles now omit redundant brand suffixes, and the homepage uses an absolute title. Smoke checks confirmed titles such as `Prism — Ideas, refracted` and `Two-phase commit, and other promises we can’t keep | Prism`.

4. **Resolved — social images and structured data.** The app now generates PNG social images at `/api/og`, sets Open Graph and Twitter image metadata, and renders `WebSite`/`Organization` and `BlogPosting` JSON-LD on the homepage and published articles. The image endpoint returned HTTP 200 with `image/png` in the local production smoke test.

5. **Resolved — private and browser-local routes.** Auth, dashboard, editor, settings, bookmarks, search, and story-preview routes now carry `noindex` metadata. Published story routes return server-rendered content and unique metadata; unpublished stories are not found and receive noindex metadata.

6. **Partially addressed — performance.** The homepage hero avatar is marked eager/high priority, and non-critical serif/monospace fonts are no longer preloaded. These are targeted changes based on the initial browser diagnostics; no Lighthouse or field Core Web Vitals measurement has been run.

### Low

7. **Resolved — private-route metadata.** Private pages are noindex and no longer eligible for indexing with generic site descriptions.

8. **Remaining production content task — legal pages.** Their metadata now accurately describes them as illustrative/demo content, but the page bodies explicitly say they are placeholders and not binding agreements or final policies. Replace and review the legal copy before production launch; it was not rewritten as part of this SEO remediation.

## Evidence and checks

- Homepage returned HTTP 200 with a unique title, a 115-character description, and one H1.
- Sampled article and topic pages returned HTTP 200 with unique descriptions and one H1 each.
- 33 distinct internal homepage links returned HTTP 200.
- Initial baseline: `/robots.txt`, `/sitemap.xml`, `/sitemap_index.xml`, and `/llms.txt` returned HTTP 404; this was before remediation.
- Decorative image elements used empty `alt` attributes; no images lacking an `alt` attribute were found in the sampled pages.
- Mobile homepage at 390px viewport had no horizontal overflow.
- A Next.js browser warning identified an avatar as LCP. No Lighthouse, CrUX, Google Search Console, analytics, or backlink measurements were available.
- Follow-up against a local production build: `/robots.txt`, `/sitemap.xml`, and `/llms.txt` returned HTTP 200; homepage and article canonicals, social images, and JSON-LD were present; `/dashboard`, `/editor/new`, `/story/demo`, `/auth/login`, `/settings`, and `/bookmarks` returned `noindex, nofollow`; `/search` returned `noindex, follow`; `/api/og` returned HTTP 200 with `image/png`.
- The follow-up server used the local production build, not a public deployment. The sitemap origin intentionally resolves to `https://prism.pub`, not localhost.

## Limitations

This audit targets local development and a local production build. It cannot establish production crawlability, indexing, ranking, live-site response behavior, or field Core Web Vitals. The SEO toolkit doctor reported that its managed runtime was not ready; run `/seo setup` and repeat the audit against a publicly reachable production URL for a complete report.
