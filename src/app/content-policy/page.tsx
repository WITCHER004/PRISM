import Link from "next/link"
import type { Metadata } from "next"
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
  title: "Content Policy",
  description: "Illustrative content-policy guidance for Prism's demo; this placeholder is not a final policy.",
  alternates: { canonical: "/content-policy" },
}

const sections: LegalSection[] = [
  {
    id: "spirit",
    title: "The spirit of it",
    body: (
      <>
        <p>
          Prism exists for thoughtful, independent writing. Disagreement, strong opinions and uncomfortable ideas are
          welcome. What isn&apos;t welcome is writing that harms people or deceives readers.
        </p>
        <p>These rules apply to stories, responses, profiles and newsletters alike.</p>
      </>
    ),
  },
  {
    id: "not-allowed",
    title: "Not allowed",
    body: (
      <ul>
        <li>Harassment, threats, or encouraging others to target a person.</li>
        <li>Hateful content that attacks people for who they are.</li>
        <li>Sexual content involving minors, or non-consensual intimate imagery, ever.</li>
        <li>Instructions that meaningfully help someone cause serious harm.</li>
        <li>Sharing someone&apos;s private information without consent.</li>
        <li>Scams, malware and deceptive links.</li>
      </ul>
    ),
  },
  {
    id: "honesty",
    title: "Honesty with readers",
    body: (
      <>
        <p>
          Readers fund writers with their attention, so that attention has to be earned honestly:
        </p>
        <ul>
          <li>Don&apos;t publish others&apos; work as your own. Quote and credit generously.</li>
          <li>Disclose sponsorships, affiliate links and paid relationships.</li>
          <li>Disclose when AI tools wrote a meaningful part of a story.</li>
          <li>Don&apos;t use misleading headlines that the story doesn&apos;t deliver on.</li>
        </ul>
      </>
    ),
  },
  {
    id: "manipulation",
    title: "Gaming the system",
    body: (
      <p>
        Because payouts follow reading time, inflating it is a form of theft from other writers. Bots, click farms,
        reading rings and similar schemes lead to withheld earnings and account closure.
      </p>
    ),
  },
  {
    id: "sensitive",
    title: "Sensitive topics",
    body: (
      <p>
        Writing about violence, self-harm, illness or abuse can be important. Add a content note at the top of
        stories that deal with these themes in detail, and avoid graphic description that serves no purpose.
      </p>
    ),
  },
  {
    id: "enforcement",
    title: "How we enforce it",
    body: (
      <>
        <p>
          Anyone can report a story or response. A person reviews every report. Depending on severity, we may add a
          warning, limit distribution, remove content or close an account.
        </p>
        <p>
          We&apos;ll tell you what we did and why, and you can appeal any decision. More on the agreement behind this
          in our <Link href="/terms">Terms of Service</Link>.
        </p>
      </>
    ),
  },
]

export default function ContentPolicyPage() {
  return (
    <LegalPage
      kicker="Community"
      title="Content Policy"
      intro="What belongs on Prism, what doesn't, and what happens when something crosses the line."
      updated="November 2, 2026"
      path="/content-policy"
      sections={sections}
    />
  )
}
