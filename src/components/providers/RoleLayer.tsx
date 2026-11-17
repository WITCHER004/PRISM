"use client"

import { useEffect } from "react"
import { UpgradeDialog } from "@/components/elite/UpgradeDialog"
import { PanelDialogs } from "@/components/panel/PanelApplication"
import { startLiveSync } from "@/lib/live/sync"

/** Mirrors Firestore into the store for the whole session (see src/lib/live/sync.ts) */
function LiveSync() {
  useEffect(() => startLiveSync(), [])
  return null
}

/** Site-wide data + role plumbing; lives inside AuthProvider because the dialogs read the auth context */
export function RoleLayer() {
  return (
    <>
      <LiveSync />
      <UpgradeDialog />
      <PanelDialogs />
    </>
  )
}
