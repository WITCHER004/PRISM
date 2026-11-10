import Link from "next/link"
import type { Metadata } from "next"
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Illustrative terms for Prism's demo. Placeholder text, not a binding agreement or legal advice.",
  alternates: { canonical: "/terms" },
}

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          These terms are an agreement between you and Prism. By creating an account, reading, publishing or paying
          on Prism, you accept them. If you don&apos;t agree, please don&apos;t use the service.
        </p>
        <p>
          We&apos;ve tried to write them in plain language. Where we say &ldquo;you&rdquo;, we mean anyone using Prism,
          whether as a reader, a writer or both.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <p>You need to be at least 16 years old to create an account. You&apos;re responsible for:</p>
        <ul>
          <li>Keeping your sign-in email secure, since it&apos;s how you access Prism.</li>
          <li>Everything that happens under your account.</li>
          <li>Giving us accurate information, and keeping it up to date.</li>
        </ul>
        <p>
          You can change your profile at any time in <Link href="/settings">Settings</Link>, and close your account
          whenever you like.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          <strong>You own what you write.</strong> Publishing on Prism gives us a non-exclusive licence to host,
          display, distribute and promote your work on Prism, for as long as it&apos;s published here. That licence
          ends when you delete the work, apart from reasonable backup copies that age out on their own.
        </p>
        <p>
          You confirm you have the rights to everything you publish, including images and quotations, and that it
          follows our <Link href="/content-policy">Content Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "memberships",
    title: "Memberships and payments",
    body: (
      <>
        <p>
          Memberships renew monthly until you cancel. You can cancel at any time from the{" "}
          <Link href="/membership">membership page</Link>; you keep access until the end of the period you&apos;ve
          paid for.
        </p>
        <p>
          A share of each membership fee is distributed to writers based on members&apos; active reading time, as
          described on our <Link href="/about#payouts">About page</Link>. Tips are passed to the writer you tip, less
          payment processing costs.
        </p>
        <p>Prices may change. We&apos;ll tell you at least 30 days before a change affects you.</p>
      </>
    ),
  },
  {
    id: "writer-earnings",
    title: "Writer earnings",
    body: (
      <>
        <p>
          Writers who enable earnings agree to our payment partner&apos;s terms and must provide accurate tax and
          payout details. We may hold payouts while we investigate suspected fraud, such as artificial reading time.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Don&apos;t misuse Prism. In particular, don&apos;t:</p>
        <ul>
          <li>Try to break, overload or probe the service without permission.</li>
          <li>Inflate reading time, claps or followers with automation or coordinated schemes.</li>
          <li>Scrape the site at scale or republish others&apos; work without permission.</li>
          <li>Impersonate another person or organisation.</li>
        </ul>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and closure",
    body: (
      <p>
        We may suspend or close accounts that seriously or repeatedly break these terms. Where we can, we&apos;ll tell
        you why and give you a chance to export your writing and subscriber list first.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <p>
        Prism is provided &ldquo;as is&rdquo;. Writers&apos; views are their own, not ours. To the extent the law
        allows, we aren&apos;t liable for indirect losses, and our total liability is limited to what you paid us in
        the twelve months before the claim.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        If we make material changes, we&apos;ll let you know in the app before they take effect. Continuing to use
        Prism after that means you accept the updated terms.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      intro="The ground rules for reading, writing and paying on Prism, written to be read rather than skimmed."
      updated="November 2, 2026"
      path="/terms"
      sections={sections}
    />
  )
}
