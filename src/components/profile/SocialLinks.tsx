import { Globe } from "lucide-react"
import { socialLinks, type SocialHandles, type SocialKey } from "@/lib/social"
import { GitHubIcon, InstagramIcon, LinkedInIcon, XIcon } from "@/components/share/BrandIcons"
import { cn } from "@/lib/utils"

export const SOCIAL_ICON: Record<SocialKey, React.ComponentType<{ className?: string }>> = {
  linkedinHandle: LinkedInIcon,
  instagramHandle: InstagramIcon,
  twitterHandle: XIcon,
  githubHandle: GitHubIcon,
}

/** All of a person's links (website + social handles) in display order */
export function profileLinks(handles: SocialHandles) {
  const website = handles.websiteUrl?.trim()
  return [
    ...(website
      ? [
          {
            key: "website",
            network: "Website",
            label: website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
            href: /^https?:\/\//.test(website) ? website : `https://${website}`,
            icon: Globe as React.ComponentType<{ className?: string }>,
          },
        ]
      : []),
    ...socialLinks(handles).map((l) => ({ ...l, icon: SOCIAL_ICON[l.key] })),
  ]
}

export function SocialLinks({ handles, className }: { handles: SocialHandles; className?: string }) {
  const links = profileLinks(handles)
  if (!links.length) return null
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {links.map(({ key, network, label, href, icon: Icon }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--fg-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="sr-only">{network}: </span>
            {label}
          </a>
        </li>
      ))}
    </ul>
  )
}
