# On-Page SEO Findings

## Resolved: title suffixes

Child page titles no longer repeat the Prism brand. The homepage has an absolute title; public route titles use the root `| Prism` template where appropriate. Local production checks confirmed the homepage and article titles.

## Resolved: social preview images and structured data

The app generates PNG social images at `/api/og` and supplies Open Graph and Twitter image metadata. The homepage renders `WebSite` and `Organization` JSON-LD; published articles render `BlogPosting` JSON-LD. The local production image endpoint returned HTTP 200 with `image/png`.

## Resolved: private application metadata

Authentication, settings, dashboard, editor, bookmarks, search, and browser-local story routes are noindex. Private pages are no longer eligible for indexing with the generic site description.

## Remaining production content task

Legal-page descriptions now identify the pages as demo/illustrative text. The page bodies are still placeholders and must be replaced and reviewed before launch.

## Positive observations

- The homepage, sampled topic, profile, and article had one H1 each.
- Sampled public pages had descriptions.
- No image was found without an `alt` attribute. Empty `alt` values observed on decorative imagery are appropriate.
