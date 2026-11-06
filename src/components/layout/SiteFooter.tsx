import Link from "next/link"
import { Wordmark } from "@/components/ui/Wordmark"

const columns = [
  {
    title: "Read",
    links: [
      { label: "Home", href: "/" },
      { label: "Explore", href: "/explore" },
      { label: "Search", href: "/search" },
      { label: "Membership", href: "/membership" },
    ],
  },
  {
    title: "Write",
    links: [
      { label: "New story", href: "/editor/new" },
      { label: "Studio", href: "/dashboard" },
      { label: "Earnings", href: "/dashboard/earnings" },
      { label: "Newsletter", href: "/dashboard/newsletter" },
    ],
  },
  {
    title: "Prism",
    links: [
      { label: "About", href: "/about" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Content policy", href: "/content-policy" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto px-3 sm:px-5 pb-3">
      <div className="max-w-7xl mx-auto panel overflow-hidden">
        <div className="h-1 spectrum-bg" />
        <div className="px-6 sm:px-10 py-10 grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-x-8 gap-y-10">
          <div className="col-span-2 md:col-span-1 max-w-xs">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-[var(--fg-muted)]">
              Independent writing, split into every topic worth your time. Owned by the people who write it.
            </p>
          </div>

          {columns.map(({ title, links }) => (
            <div key={title}>
              <h4 className="meta mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)] transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-6 sm:px-10 py-5 border-t border-[var(--border)] flex flex-col sm:flex-row justify-between gap-2 meta">
          <p>© {new Date().getFullYear()} Prism Publishing</p>
          <p>Built for writers · Owned by writers</p>
        </div>
      </div>
    </footer>
  )
}
