import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prism — Ideas, refracted",
    short_name: "Prism",
    description: "Independent writing for curious readers. Discover stories across topics and follow the writers you value.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#141413",
    icons: [{ src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
  }
}
