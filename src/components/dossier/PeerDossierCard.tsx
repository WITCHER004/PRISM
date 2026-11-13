"use client"

import { useId, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronDown, CircleCheck, CircleHelp, MessageSquareReply, Scale } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { consensusPercent, PASS_THRESHOLD, reviewerInfo, type PeerDossier } from "@/lib/dossier"
import { dur, ease } from "@/lib/motion"
import { cn, formatDate } from "@/lib/utils"

// "Peer Review Dossier (10-Panel Audit)": collapsed it's a one-line verdict; open it shows why
// the panel passed the piece, the dissent, and the author's rebuttal.
export function PeerDossierCard({
  dossier,
  authorName,
  authorAvatar,
  className,
}: {
  dossier: PeerDossier
  authorName: string
  authorAvatar?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const d = dossier
  const pct = consensusPercent(d)

  return (
    <section
      aria-label="Peer Review Dossier"
      className={cn("rounded-[20px] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] overflow-hidden", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 px-5 py-4 text-left hover:bg-[var(--bg)] transition-colors"
      >
        <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[var(--elite-wash)] text-[var(--elite-ink)]">
          <Scale className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-semibold text-[1.0625rem] tracking-tight">Peer Review Dossier</span>
          <span className="block text-sm text-[var(--fg-muted)]">
            {d.panelSize}-Panel Audit · decided {formatDate(d.decidedAt)}
          </span>
        </span>
        <span className="order-last sm:order-none w-full sm:w-auto flex items-center gap-3">
          <PanelDots dossier={d} />
          <span className="text-sm font-medium tabular-nums whitespace-nowrap">
            {d.approvals}/{d.panelSize} Reviewers Approved <span className="text-[var(--fg-muted)] font-normal">· {pct}% Consensus</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("w-4 h-4 shrink-0 text-[var(--fg-muted)] transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ height: 0, opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-5 pt-5 pb-6 space-y-7">
              <ApproverRow dossier={d} />

              {d.commendations.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <CircleCheck className="w-4 h-4 text-[var(--craft-ink)]" /> Why it passed
                  </h3>
                  <ul className="mt-3 space-y-4">
                    {d.commendations.map((c) => {
                      const r = reviewerInfo(c.reviewer)
                      return (
                        <li key={c.reviewer} className="flex gap-3">
                          <Avatar src={r.avatarUrl} alt={r.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{r.name}</span>{" "}
                              <span className="text-[var(--fg-muted)]">· {r.field}</span>
                            </p>
                            <p className="mt-1 font-serif text-[1.03rem] leading-relaxed text-[var(--fg-secondary)]">{c.text}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {d.dissents.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <CircleHelp className="w-4 h-4 text-[var(--elite-ink)]" />
                    {d.dissents.length === 1 ? "Dissent and rebuttal" : "Dissents and rebuttals"}
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {d.dissents.map((x) => {
                      const r = reviewerInfo(x.reviewer)
                      return (
                        <li key={x.reviewer} className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
                          <div className="flex gap-3">
                            <Avatar src={r.avatarUrl} alt={r.name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm">
                                <span className="font-medium">{r.name}</span>{" "}
                                <span className="text-[var(--fg-muted)]">· {r.field} · question raised</span>
                              </p>
                              <p className="mt-1 font-serif text-[1.03rem] leading-relaxed text-[var(--fg-secondary)]">{x.question}</p>
                            </div>
                          </div>

                          {x.rebuttal ? (
                            <div className="mt-4 ml-11 pl-4 border-l border-[var(--border-strong)]">
                              <p className="flex items-center gap-1.5 text-sm">
                                <MessageSquareReply className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
                                <span className="font-medium">Author&apos;s Counter-Rebuttal</span>
                                <span className="text-[var(--fg-muted)]">· {authorName}</span>
                              </p>
                              <div className="mt-1.5 flex gap-2.5">
                                <Avatar src={authorAvatar} alt={authorName} size="xs" className="mt-0.5" />
                                <p className="font-serif text-[1.03rem] leading-relaxed text-[var(--fg-secondary)]">{x.rebuttal.text}</p>
                              </div>
                              {x.outcome && (
                                <p
                                  className={cn(
                                    "mt-3 inline-flex flex-wrap items-baseline gap-x-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px]",
                                    x.outcome.status === "ACCEPTED"
                                      ? "bg-[var(--craft-wash)] text-[var(--craft-ink)]"
                                      : "bg-[var(--surface)] text-[var(--fg-secondary)]"
                                  )}
                                >
                                  <span className="font-semibold">
                                    {x.outcome.status === "ACCEPTED" ? "Rebuttal accepted" : "Dissent upheld"}
                                  </span>
                                  <span className="opacity-90">“{x.outcome.note}”</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 ml-11 text-sm text-[var(--fg-muted)]">The author didn&apos;t file a rebuttal to this point.</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <p className="text-xs text-[var(--fg-muted)]">
                {d.panelSize} independent specialists vote; {PASS_THRESHOLD} approvals publish an Elite article. Dissenting
                votes and the author&apos;s replies stay on the public record.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/** One dot per panel seat: filled for approvals */
function PanelDots({ dossier }: { dossier: PeerDossier }) {
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: dossier.panelSize }, (_, i) => (
        <span
          key={i}
          className={cn("w-1.5 h-4 rounded-full", i < dossier.approvals ? "bg-[var(--craft-ink)]" : "bg-[var(--border-strong)]")}
        />
      ))}
    </span>
  )
}

function ApproverRow({ dossier }: { dossier: PeerDossier }) {
  const people = dossier.approvedBy.map(reviewerInfo)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex -space-x-2">
        {people.map((p) => (
          <Avatar key={p.name} src={p.avatarUrl} alt={p.name} size="sm" className="ring-2 ring-[var(--panel)]" />
        ))}
      </div>
      <p className="text-sm text-[var(--fg-muted)] min-w-0">
        Approved by {people.slice(0, 2).map((p) => p.name).join(", ")}
        {people.length > 2 && ` and ${people.length - 2} more`}
      </p>
    </div>
  )
}
