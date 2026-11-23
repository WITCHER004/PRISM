import type { Metadata } from "next"
import { Bricolage_Grotesque, Source_Serif_4, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { AuthProvider } from "@/components/providers/AuthProvider"
import { RoleLayer } from "@/components/providers/RoleLayer"
import { SITE_URL, socialImageUrl } from "@/lib/seo"
import { THEME_SCRIPT } from "@/lib/theme-script"
import { headers } from "next/headers"

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-source-serif",
  display: "swap",
  preload: false,
})

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    template: "%s | Prism",
    default: "Prism — Ideas, refracted",
  },
  description:
    "A modern publishing platform for independent thinkers. Read, write, and earn without compromise.",
  openGraph: {
    type: "website",
    siteName: "Prism",
    title: "Prism — Ideas, refracted",
    description: "A modern publishing platform for independent thinkers.",
    images: [
      {
        url: socialImageUrl("Prism — Ideas, refracted", "Independent writing, read by humans."),
        width: 1200,
        height: 630,
        alt: "Prism — independent writing, read by humans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: socialImageUrl("Prism — Ideas, refracted", "Independent writing, read by humans."),
        alt: "Prism — independent writing, read by humans",
      },
    ],
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The per-request CSP nonce from src/proxy.ts (reading headers() renders each page per request)
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${sourceSerif.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Apply the saved theme before first paint so a reload never flashes the wrong theme */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: THEME_SCRIPT,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <RoleLayer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
