import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, BookOpenText, Clock, HandCoins, KeyRound, Scale, Sparkles, UserCheck, Users } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Reveal } from "@/components/motion/Reveal"
import { RevealText } from "@/components/motion/RevealText"
import { hueStyle } from "@/lib/topics"
import { socialImageUrl } from "@/lib/seo"

export const metadata: Metadata = {
  title: "About",
  description: "Why Prism exists, how writers get paid, and what we will and won't do.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Prism",
    description: "Why Prism exists, how writers get paid, and what we will and won't do.",
    images: [socialImageUrl("About Prism", "Why Prism exists, how writers get paid, and what we will and won't do.")],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Prism",
    description: "Why Prism exists, how writers get paid, and what we will and won't do.",
    images: [socialImageUrl("About Prism", "Why Prism exists, how writers get paid, and what we will and won't do.")],
  },
}

const STEPS = [
  {
    icon: Users,
    title: "You become a member",
    body: "Reading free stories costs nothing. If you choose a membership, your monthly fee goes into your own writers' pool.",
  },
  {
    icon: Clock,
    title: "You read, at your pace",
    body: "We measure active reading time: a story open, in view, and being read or listened to. Idle tabs and quick bounces don't count.",
  },
  {
    icon: Scale,
    title: "Your pool follows your attention",
    body: "At the end of the month, your pool is divided between the writers you read, in proportion to the time you spent with each.",
  },
  {
    icon: HandCoins,
    title: "Tips go straight through",
    body: "Loved one story in particular? Tips skip the pool entirely and go to that writer directly.",
  },
]

const VALUES = [
  {
    hue: "writing",
    icon: BookOpenText,
    title: "Curiosity isn't punished",
    body: "A link from a friend should open the story, not a wall. Previews are generous, and members unlock everything.",
  },
  {
    hue: "climate",
    icon: KeyRound,
    title: "Writers own their audience",
    body: "Your subscriber list exports in a click. Point your own domain at your publication. Leave whenever you want, and take your readers with you.",
  },
  {
    hue: "ai-ml",
    icon: Sparkles,
    title: "Attention, not outrage",
    body: "There's no engagement-maximising feed. Home shows writers you follow and topics you chose, in an order you can understand.",
  },
  {
    hue: "design",
    icon: UserCheck,
    title: "Written by people",
    body: "Prism is a place for human writing. Writers disclose meaningful AI assistance, and readers can always see who stands behind a story.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-14">
          <p className="meta">About Prism</p>
          <RevealText
            className="display mt-4 text-[3rem] sm:text-[4.5rem] lg:text-[5.5rem] leading-[0.95] max-w-5xl"
            lines={[{ text: "Writing deserves" }, { text: "a better economy.", className: "spectrum-text spectrum-sweep" }]}
            delay={0.05}
          />
          <p className="mt-7 max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--fg-muted)]">
            Prism is a publishing platform where readers fund the writers they actually read, writers keep their
            audience, and nothing is designed to keep you scrolling after you&apos;ve had enough.
          </p>
        </section>

        {/* Mission */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal>
            <div className="panel p-6 sm:p-10 lg:p-14 grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16">
              <div>
                <p className="meta">Our mission</p>
                <h2 className="display mt-3 text-[2rem] sm:text-[2.75rem]">One beam of curiosity, every topic worth it.</h2>
              </div>
              <div className="space-y-5 text-[1.0625rem] leading-relaxed text-[var(--fg-secondary)]">
                <p>
                  A prism takes a single beam of white light and shows you everything it was made of. That&apos;s what
                  good writing does with an idea, and it&apos;s what we want reading to feel like: following your
                  curiosity from one topic into the next, guided by people who know their subject.
                </p>
                <p>
                  The web made publishing free, then made attention the product. Writers ended up optimising for
                  clicks, readers ended up behind paywalls that punish a single curious tap, and the platforms in the
                  middle kept the audience. We think the incentives can simply point the other way.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Payouts */}
        <section id="payouts" className="scroll-mt-28 max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal className="max-w-2xl">
            <p className="meta">How payouts work, in principle</p>
            <h2 className="display mt-3 text-[2rem] sm:text-[2.75rem]">Money follows minutes, not clicks.</h2>
            <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
              The model is simple enough to explain in four steps, and it rewards the writing that genuinely holds your
              attention.
            </p>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <Reveal as="li" key={s.title} index={i} className="panel p-6 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="grid place-items-center w-11 h-11 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="font-mono text-sm text-[var(--fg-subtle)] tabular-nums">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 font-display text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">{s.body}</p>
                </Reveal>
              )
            })}
          </ol>
          <Reveal className="mt-4">
            <p className="text-xs text-[var(--fg-subtle)] leading-relaxed max-w-2xl">
              This describes how Prism is designed to work. The current site is a demo: no real payments are taken or
              paid out.
            </p>
          </Reveal>
        </section>

        {/* Values */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal className="max-w-2xl">
            <p className="meta">What we believe</p>
            <h2 className="display mt-3 text-[2rem] sm:text-[2.75rem]">Four promises we design around.</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {VALUES.map((v, i) => {
              const Icon = v.icon
              return (
                <Reveal key={v.title} index={i}>
                  <div style={hueStyle(v.hue)} className="relative h-full panel p-6 sm:p-8 overflow-hidden">
                    <div aria-hidden className="absolute inset-0 hue-glow opacity-60" />
                    <div className="relative">
                      <span className="grid place-items-center w-11 h-11 rounded-full hue-wash hue-ink">
                        <Icon className="w-5 h-5" />
                      </span>
                      <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight">{v.title}</h3>
                      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed max-w-md">{v.body}</p>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] bg-[var(--fg)] text-[var(--bg)] p-8 sm:p-12">
              <div className="absolute inset-x-0 top-0 h-1.5 spectrum-bg" />
              <div className="grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider opacity-60">Join in</p>
                  <h2 className="display mt-3 text-4xl sm:text-5xl">
                    Read something good.
                    <br />
                    Or write it.
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--bg)] text-[var(--fg)] font-medium hover:opacity-90 transition-opacity"
                  >
                    Start reading <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/auth/signup?writer=true"
                    className="inline-flex items-center h-12 px-6 rounded-full border border-[var(--bg)]/30 font-medium hover:border-[var(--bg)] transition-colors"
                  >
                    Start writing
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
          <p className="mt-6 text-sm text-[var(--fg-muted)]">
            Curious about membership?{" "}
            <Link href="/membership" className="font-medium text-[var(--fg)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--fg)]">
              See the plans
            </Link>
            . House rules live in our{" "}
            <Link href="/content-policy" className="font-medium text-[var(--fg)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--fg)]">
              content policy
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
