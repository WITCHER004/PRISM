import Link from "next/link"
import { ArrowRight, FlaskConical } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { LegalIndex, LegalIndexMobile } from "./LegalIndex"
import { cn } from "@/lib/utils"

export interface LegalSection {
  id: string
  title: string
  body: React.ReactNode
}

const DOCS = [
  { href: "/terms", label: "Terms of Service", blurb: "The agreement for using Prism" },
  { href: "/privacy", label: "Privacy Policy", blurb: "What we collect and why" },
  { href: "/content-policy", label: "Content Policy", blurb: "What belongs on Prism" },
]

interface LegalPageProps {
  kicker: string
  title: string
  intro: string
  updated: string
  path: string
  sections: LegalSection[]
}

// Long-form layout shared by the legal pages: head, demo notice, sticky index, readable body
export function LegalPage({ kicker, title, intro, updated, path, sections }: LegalPageProps) {
  const items = sections.map(({ id, title }) => ({ id, title }))
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <header className="max-w-3xl">
            <p className="meta">{kicker}</p>
            <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem]">{title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">{intro}</p>
            <p className="meta mt-5">Last updated {updated}</p>
          </header>

          <div
            role="note"
            className="mt-8 max-w-3xl flex items-start gap-3 rounded-[16px] bg-[var(--warning-subtle)] px-5 py-4 text-sm leading-relaxed"
          >
            <FlaskConical className="w-4 h-4 mt-0.5 shrink-0 text-[var(--warning)]" />
            <p className="text-[var(--fg-secondary)]">
              <span className="font-medium text-[var(--warning)]">Placeholder text for a demo.</span> This page shows
              how Prism&apos;s policies would read. It is not a binding agreement or legal advice, and it hasn&apos;t
              been reviewed by a lawyer.
            </p>
          </div>

          <div className="mt-10 grid lg:grid-cols-[220px_minmax(0,1fr)] gap-10 lg:gap-16">
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <LegalIndex items={items} />
              </div>
            </aside>
            <div className="lg:hidden">
              <LegalIndexMobile items={items} />
            </div>

            <article className="prose-prism min-w-0">
              {sections.map((s, i) => (
                <section key={s.id} aria-labelledby={s.id}>
                  <h2 id={s.id} className={cn(i === 0 && "!mt-0")}>
                    <span className="font-mono text-[0.55em] align-middle mr-3 text-[var(--fg-subtle)] font-normal tracking-normal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}
            </article>
          </div>

          {/* Other documents */}
          <nav aria-label="Other policies" className="mt-16 lg:ml-[calc(220px+4rem)] max-w-3xl">
            <p className="meta mb-3">Other policies</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {DOCS.filter((d) => d.href !== path).map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="group panel p-5 flex items-center justify-between gap-3 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow)] transition-[border-color,box-shadow]"
                >
                  <span>
                    <span className="block font-medium">{d.label}</span>
                    <span className="block text-sm text-[var(--fg-muted)]">{d.blurb}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--fg-muted)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
