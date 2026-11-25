import { permanentRedirect } from "next/navigation"

// Prism has one paid plan, Elite. Old /membership links land there.
export default function MembershipPage() {
  permanentRedirect("/elite")
}
