import Link from "next/link"
import type { Metadata } from "next"
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Prism collects, why, and the choices you have (demo placeholder).",
}

const sections: LegalSection[] = [
  {
    id: "short-version",
    title: "The short version",
    body: (
      <>
        <p>
          We collect what we need to run Prism and pay writers fairly, and nothing more. We don&apos;t sell your data,
          we don&apos;t run third-party advertising, and we don&apos;t use tracking pixels.
        </p>
        <p>
          <strong>In this demo</strong>, nothing leaves your browser at all: your session, profile, drafts and
          preferences are stored in your browser&apos;s local storage, and you can clear them from{" "}
          <Link href="/settings#account">Settings → Account</Link>.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <ul>
          <li>
            <strong>Account details:</strong> your email, name, and anything you add to your profile.
          </li>
          <li>
            <strong>Your writing:</strong> drafts, published stories, responses and the images you upload.
          </li>
          <li>
            <strong>Reading activity:</strong> which stories you read and for how long, used to calculate writer
            payouts and to power your reading history.
          </li>
          <li>
            <strong>Payment details:</strong> handled by our payment partner. We see only the last four digits of a
            card and its expiry.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: (
      <>
        <p>We use your information to:</p>
        <ul>
          <li>Run your account and show you writers and topics you follow.</li>
          <li>Divide membership fees between writers by reading time.</li>
          <li>Send the emails you&apos;ve opted into, like the weekly digest.</li>
          <li>Keep Prism secure and detect fraud, such as artificial reading time.</li>
        </ul>
      </>
    ),
  },
  {
    id: "writers",
    title: "What writers can see",
    body: (
      <p>
        Writers see aggregate statistics: views, reads, reading time and earnings. If you subscribe to a
        writer&apos;s newsletter, they receive your email address so they can send it to you, and can take that list
        with them if they leave Prism.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and storage",
    body: (
      <p>
        We use a small number of first-party cookies and local storage for sign-in and your reading preferences, such
        as theme and text size. There are no advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    id: "your-choices",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can, at any time:</p>
        <ul>
          <li>Edit your profile and email preferences in Settings.</li>
          <li>Export your stories and subscriber list.</li>
          <li>Ask for a copy of the data we hold about you, or ask us to delete it.</li>
        </ul>
        <p>Depending on where you live, you may have further rights under local law.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <p>
        We keep your data while your account is open. When you close it, we delete your personal data within 30 days,
        except where we must keep records for tax or legal reasons.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>If we change how we handle your data in a meaningful way, we&apos;ll tell you in the app first.</p>,
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      intro="What we collect, why we collect it, and how to keep control of it."
      updated="November 2, 2026"
      path="/privacy"
      sections={sections}
    />
  )
}
