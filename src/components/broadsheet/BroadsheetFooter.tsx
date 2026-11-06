import Link from "next/link"

export function BroadsheetFooter() {
  return (
    <footer className="mt-20 border-t-2 border-[var(--border-strong)] bg-[var(--bg)] text-[var(--fg)] font-serif">
      {/* ── Broadsheet Double Hairline Divider ── */}
      <div className="border-b border-[var(--border-strong)] h-1" />

      {/* ── Main Colophon Grid (4 Broadsheet Columns) ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-[var(--border)]">
          {/* Column 1: The Charter & Identity */}
          <div className="lg:pr-8">
            <h3 className="font-serif text-2xl font-black uppercase tracking-tight mb-2">
              The Prism
            </h3>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--accent)] font-semibold mb-3">
              Independent Digital Publication
            </p>
            <p className="text-sm font-serif leading-relaxed text-[var(--fg-muted)] mb-4">
              A home for technical essays, investigative journalism, and direct creator publishing. Writers own their audience and publish without algorithmic curation.
            </p>
            <div className="text-[11px] font-mono text-[var(--fg-subtle)] space-y-1">
              <div>FORMAT: EDITORIAL BROADSHEET</div>
              <div>DISTRIBUTION: OPEN WEB &amp; RSS</div>
            </div>
          </div>

          {/* Column 2: Editorial Departments */}
          <div className="lg:px-8">
            <h4 className="text-xs font-mono uppercase tracking-widest font-bold border-b border-[var(--border)] pb-1.5 mb-3">
              Desks &amp; Coverage
            </h4>
            <ul className="space-y-2 text-sm font-sans">
              <li>
                <Link href="/explore/investigations" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Investigative Reporting
                </Link>
              </li>
              <li>
                <Link href="/explore/technology" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Systems &amp; Architecture
                </Link>
              </li>
              <li>
                <Link href="/explore/science" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Science &amp; Climate
                </Link>
              </li>
              <li>
                <Link href="/explore/programming" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Software Engineering Craft
                </Link>
              </li>
              <li>
                <Link href="/explore/design" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Design Systems &amp; Typography
                </Link>
              </li>
              <li>
                <Link href="/explore/startups" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Economics &amp; Technology Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Standards & Policy */}
          <div className="lg:px-8">
            <h4 className="text-xs font-mono uppercase tracking-widest font-bold border-b border-[var(--border)] pb-1.5 mb-3">
              Standards &amp; Policies
            </h4>
            <ul className="space-y-2 text-sm font-sans">
              <li>
                <Link href="/about" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  About The Prism
                </Link>
              </li>
              <li>
                <Link href="/content-policy" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Publishing &amp; Distribution Rights
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Privacy &amp; Data Ethics
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/editor/new" className="hover:text-[var(--accent)] hover:underline underline-offset-4 transition-colors">
                  Publish on The Prism
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Membership & Support */}
          <div className="lg:pl-8">
            <h4 className="text-xs font-mono uppercase tracking-widest font-bold border-b border-[var(--border)] pb-1.5 mb-3">
              Reader Membership
            </h4>
            <p className="text-sm font-serif leading-relaxed text-[var(--fg-muted)] mb-3">
              Independent writing sustained directly by readers. 95% of proceeds go directly to authors.
            </p>
            <div className="space-y-2">
              <Link
                href="/membership"
                className="block text-center py-2 px-3 border border-[var(--border-strong)] bg-[var(--fg)] text-[var(--bg)] font-mono uppercase text-xs font-bold tracking-wider hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                Become a Member &bull; $8/mo
              </Link>
              <Link
                href="/auth/signup?writer=true"
                className="block text-center py-2 px-3 border border-[var(--border)] bg-[var(--panel)] font-mono uppercase text-xs font-semibold tracking-wider hover:border-[var(--border-strong)] transition-colors"
              >
                Start Writing
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Footer Strip ── */}
      <div className="border-t border-[var(--border)] py-4 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[var(--fg-muted)]">
          <div className="flex items-center gap-3 flex-wrap">
            <span>THE PRISM DIGITAL JOURNAL</span>
            <span className="text-[var(--border)]">/</span>
            <span>DIRECT INDEPENDENT PUBLISHING</span>
            <span className="text-[var(--border)]">/</span>
            <span className="text-[var(--accent)] font-semibold">ALL RIGHTS RESERVED</span>
          </div>

          <div className="flex items-center gap-4">
            <span>&copy; {new Date().getFullYear()} The Prism</span>
            <Link href="#top" className="hover:text-[var(--fg)] uppercase tracking-wider underline">
              Back to Top &uarr;
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
