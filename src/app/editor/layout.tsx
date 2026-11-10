import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Writing studio",
    template: "%s | Prism Studio",
  },
  robots: { index: false, follow: false },
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
