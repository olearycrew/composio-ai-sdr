"use client"
import { useState } from "react"
import { Check, FilePenLine, X } from "lucide-react"
import type { Proposal } from "@/lib/sdr"
import { useRun } from "./run-context"
function EmailReview({ proposal }: { proposal: Proposal }) {
  const { run, refresh } = useRun()
  const [subject, setSubject] = useState(proposal.subject),
    [body, setBody] = useState(proposal.body)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const prospect = run?.prospects.find((p) => p.id === proposal.prospectId)
  const pending = proposal.status === "pending"
  async function decide(decision: "approve" | "reject") {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run!.id,
          proposalId: proposal.id,
          decision,
          subject,
          body,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok)
        throw new Error(
          data.error ??
            data.call?.error ??
            "Draft was not confirmed. Review its status before continuing."
        )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed")
    } finally {
      await refresh()
      setBusy(false)
    }
  }
  return (
    <article className="review-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FilePenLine size={15} />
        <span>
          To {prospect?.person} · {prospect?.email}
        </span>
        <span className="ml-auto capitalize">{proposal.status}</span>
      </div>
      <label className="mt-4 block text-xs font-medium">
        Subject
        <input
          aria-label={`Subject for ${prospect?.person}`}
          className="review-subject"
          value={subject}
          disabled={!pending || busy}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </label>
      <label className="mt-3 block text-xs font-medium">
        Email
        <textarea
          aria-label={`Email for ${prospect?.person}`}
          className="review-body"
          value={body}
          disabled={!pending || busy}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {pending && (
        <div className="mt-4 flex gap-2">
          <button
            className="primary-button"
            disabled={busy || !subject.trim() || body.length < 20}
            onClick={() => decide("approve")}
          >
            <Check size={14} />
            {busy ? "Saving…" : "Approve & create draft"}
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => decide("reject")}
          >
            <X size={14} />
            Reject
          </button>
        </div>
      )}
      {proposal.draftId && (
        <p className="mt-3 text-xs text-teal-800">
          Saved to your Gmail drafts. Nothing sent.
        </p>
      )}
    </article>
  )
}
export function EmailReviews() {
  const { run } = useRun()
  if (!run?.proposals.length)
    return (
      <div className="empty-panel">
        <FilePenLine size={28} />
        <h2>Your first emails will appear here</h2>
        <p>
          Read, edit or reject each preview. Approval creates a draft in your
          Gmail.
        </p>
      </div>
    )
  return (
    <div className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Review your outreach</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit before approving. Recipients have passed verification and
          exclusion checks.
        </p>
      </div>
      {run.proposals.map((p) => (
        <EmailReview key={p.id} proposal={p} />
      ))}
    </div>
  )
}
