# SEO Action Plan

## Phase 1: Technical foundations

1. [x] Add a production-aware `robots.ts` and `sitemap.ts`.
   - Include canonical public pages, topic pages, profiles, and published stories.
   - Exclude login, signup, dashboard, settings, editor, bookmarks, and browser-local story previews where appropriate.
   - Verify production responses and sitemap URLs use the production host.
2. [x] Add absolute canonical URLs to indexable pages.
   - Verify the homepage, topics, profiles, and articles each canonicalize to their preferred public URL.
3. [x] Add route-level robots metadata to private and client-only pages.
   - Confirm draft/story preview content is not indexable.
   - Published stories must expose their content and unique metadata in server-rendered HTML.

## Phase 2: Metadata and sharing

4. [x] Remove redundant brand suffixes from child titles and set a non-duplicated homepage title.
5. [x] Add an absolute Open Graph image and matching Twitter image metadata.
6. [x] Add JSON-LD for the site and published articles. External rich-result validators remain to be run.
7. [x] Make legal-page descriptions accurately identify demo placeholders. **Still required before launch:** replace and legally review the placeholder page bodies.

## Phase 3: Performance validation

8. [ ] Run Lighthouse against a production build at desktop and mobile sizes.
9. [x] Prioritize the homepage hero avatar based on the initial LCP diagnostic. **Still required:** confirm against a Lighthouse trace.
10. [x] Disable preloading for non-critical serif and monospace fonts.
11. [ ] Recheck LCP, INP, CLS, image transfer size, and console/network errors after changes.

## Phase 4: Production verification

12. [ ] Run the full SEO audit after `/seo setup` against the public production URL.
13. [ ] Connect Search Console/analytics only if available, then validate indexing, real Core Web Vitals, and organic search performance.
14. [ ] Recheck the sitemap, robots rules, canonicals, social cards, structured data, and representative internal links on production.
