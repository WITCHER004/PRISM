# Performance and AI Search Findings

## Performance: measurement required

The initial browser identified an avatar image as a homepage LCP candidate and warned that several font assets were preloaded but unused shortly after page load. The homepage hero avatar is now eager/high priority, and non-critical serif and monospace fonts are no longer preloaded.

These are targeted changes based on diagnostic warnings, not measured LCP/CLS/INP results. Run Lighthouse against a production build, inspect its LCP trace and font waterfall, and tune further only after confirming the measured bottlenecks.

## AI discovery: addressed, with production verification pending

`/llms.txt` now exists, and JSON-LD is present on the homepage and published articles. The local production build served the file and schema. Verify crawler behavior and structured data on the deployed production URL; this audit does not prove AI crawler access or search indexing.
