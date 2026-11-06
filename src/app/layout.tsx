import type { Metadata } from "next"
import { Bricolage_Grotesque, Source_Serif_4, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/ThemeProvider"

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
})

export const metadata: Metadata = {
  title: {
    template: "%s | Prism",
    default: "Prism — Ideas, refracted",
  },
  description:
    "A modern publishing platform for independent thinkers. Read, write, and earn without compromise.",
  metadataBase: new URL("https://prism.pub"),
  openGraph: {
    type: "website",
    siteName: "Prism",
    title: "Prism — Ideas, refracted",
    description: "A modern publishing platform for independent thinkers.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@prism_pub",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${sourceSerif.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Apply the saved theme before first paint so a reload never flashes the wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem("prism-store")||"{}").state||{};if(s.theme)document.documentElement.setAttribute("data-theme",s.theme);if(s.fontSize)document.documentElement.setAttribute("data-fontsize",s.fontSize)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
