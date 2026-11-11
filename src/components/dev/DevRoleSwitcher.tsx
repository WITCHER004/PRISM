"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, PenLine, X } from "lucide-react"
import { useHydrated } from "@/components/studio/useHydrated"
import { useSubscription } from "@/components/elite/hooks"
import { DEV_TOOLS } from "@/lib/devtools"
import { MOCK_USERS, PEER_REVIEWERS } from "@/lib/data"
import { SAMPLE_ARTICLE } from "@/lib/elite/demo"
import { useUIStore, toast } from "@/lib/store"
import { cn } from "@/lib/utils"

// Floating dev bar for testing every role in demo mode without signing out:
// Free writer → Elite writer → Employee reviewer → any of the 10 peer-panel members.

const PERSONAS = [
  { key: "free", username: "alexchen", label: "Free writer", hint: "Alex Chen · starts on Free, can upgrade" },
  { key: "elite", username: "priyarao", label: "Elite writer", hint: "Priya Rao · Elite, has badges" },
  { key: "employee", username: "noorhaddad", label: "Employee reviewer", hint: "Noor Haddad · review queue + panel lead" },
] as const

export function DevRoleSwitcher() {
  const hydrated = useHydrated()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const currentUser = useUIStore((s) => s.currentUser)
  const setCurrentUser = useUIStore((s) => s.setCurrentUser)
  const saveDraft = useUIStore((s) => s.saveDraft)
  const { isElite } = useSubscription()
  if (!DEV_TOOLS || !hydrated) return null

  const panelIndex = PEER_REVIEWERS.findIndex((u) => u.username === currentUser)
  const who = [...MOCK_USERS, ...PEER_REVIEWERS].find((u) => u.username === currentUser)

  const switchTo = (username: string, label: string) => {
    setCurrentUser(username)
    toast(`Now testing as ${label}`, { tone: "success" })
  }

  const newSampleDraft = () => {
    const id = "d_" + Math.random().toString(36).slice(2, 10)
    saveDraft({ id, ...SAMPLE_ARTICLE, paywall: "FREE" })
    setOpen(false)
    router.push(`/editor/${id}`)
  }

  return (
    <div className="fixed z-[70] bottom-4 right-4 flex flex-col items-end gap-2">
      {open && (
        <div
          role="dialog"
          aria-label="Dev role switcher"
          className="w-[300px] max-w-[calc(100vw-2rem)] rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] text-slate-800"
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Test as</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid place-items-center w-7 h-7 rounded-full hover:bg-slate-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {PERSONAS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => switchTo(p.username, p.label)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-[10px] border transition-colors",
                    currentUser === p.username ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:bg-slate-50"
                  )}
                >
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="block text-xs text-slate-500">{p.hint}</span>
                </button>
              </li>
            ))}
            <li className="px-3 py-2 rounded-[10px] border border-transparent">
              <label className="block text-sm font-medium" htmlFor="dev-panel-member">
                10-panel reviewer
              </label>
              <select
                id="dev-panel-member"
                value={panelIndex >= 0 ? PEER_REVIEWERS[panelIndex].username : ""}
                onChange={(e) => {
                  const u = PEER_REVIEWERS.find((x) => x.username === e.target.value)
                  if (u) switchTo(u.username, `${u.displayName} (panel)`)
                }}
                className={cn(
                  "mt-1 w-full h-9 px-2.5 rounded-[8px] border bg-white text-sm",
                  panelIndex >= 0 ? "border-indigo-300" : "border-slate-200"
                )}
              >
                <option value="" disabled>
                  Pick a panel member…
                </option>
                {PEER_REVIEWERS.map((u, i) => (
                  <option key={u.username} value={u.username}>
                    {i + 1}. {u.displayName}
                  </option>
                ))}
              </select>
            </li>
          </ul>
          <div className="mt-2 pt-2 border-t border-slate-100 grid gap-1">
            <button
              type="button"
              onClick={newSampleDraft}
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm hover:bg-slate-50"
            >
              <PenLine className="w-4 h-4 text-slate-500" /> New 200-word test article
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentUser(null)
                toast("Signed out (anonymous reader)")
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm text-slate-600 hover:bg-slate-50"
            >
              Anonymous reader
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 h-10 pl-3 pr-4 rounded-full border border-slate-200 bg-white text-sm text-slate-700 shadow-[0_6px_20px_-8px_rgba(15,23,42,0.3)] hover:border-slate-300"
      >
        <FlaskConical className="w-4 h-4 text-indigo-600" />
        <span className="max-w-[160px] truncate">{who ? who.displayName : "Signed out"}</span>
        {isElite && <span className="text-[10px] font-semibold uppercase text-indigo-700">Elite</span>}
      </button>
    </div>
  )
}
