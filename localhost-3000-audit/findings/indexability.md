# Indexability Findings

## Resolved: private and browser-local routes

Authentication, dashboard, settings, editor, bookmarks, search, and browser-local story-preview routes now carry `noindex` metadata. Local production checks confirmed `noindex, nofollow` on `/dashboard`, `/editor/new`, `/story/demo`, `/auth/login`, `/settings`, and `/bookmarks`; `/search` returns `noindex, follow`.

Published story pages expose unique metadata and content in server-rendered HTML. Unpublished stories now return not found and receive noindex metadata rather than being presented as public articles.

## Production verification pending

Repeat these checks on the publicly deployed site. A local production build cannot establish live crawlability or indexing.
