# Technical SEO Findings

## Resolved: robots, sitemap, and AI discovery files

The app now serves `/robots.txt`, `/sitemap.xml`, and `/llms.txt`. Local production smoke checks returned HTTP 200 for each. The sitemap uses the configured production origin, refreshes hourly, and includes public pages, topics, profiles, and published stories.

## Resolved: canonical tags

The homepage, public articles, profiles, topics, and static public pages now emit canonical URLs based on the configured production origin. Local production smoke checks confirmed the homepage and article canonicals do not point to localhost.

## Crawl and mobile checks

- 33 distinct internal homepage links returned HTTP 200 in the initial audit.
- An unknown route returned HTTP 404.
- Homepage at 390px viewport had no horizontal overflow.
- A local production build returned HTTP 200 for the robots, sitemap, and llms endpoints.
- The SEO runtime was unavailable, so Lighthouse and field data were not measured.
