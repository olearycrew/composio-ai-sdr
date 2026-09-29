"use client"
import { isToolUIPart, getToolName } from "ai"
import { CheckCircle2, Loader2, CircleAlert } from "lucide-react"
import type { ChatMessagePart } from "@/tools"
import { money, type Call, type Plan } from "@/lib/sdr"
import { ToolCard } from "@/components/tool-card"
import { EmailReviews } from "@/components/email-review"
export type ToolPartProps = { part: ChatMessagePart }
export function SdrToolPart({ part }: ToolPartProps) {
  if (!isToolUIPart(part)) return null
  const name = getToolName(part)
  const done = part.state === "output-available"
  const fail = part.state === "output-error"
  const output = done ? (part.output as Record<string, unknown>) : undefined
  if (name === "ask_user" && done) return <EmailReviews />
  if (name === "plan_research" && done) {
    const plan = output as Plan | undefined
    return (
      <article className="plan-card">
        <div className="eyebrow">Plan before spending</div>
        <p className="mt-2 text-sm">{plan?.summary}</p>
        {plan?.lines?.map((l, i) => (
          <div
            key={i}
            className="mt-2 flex items-center justify-between gap-3 text-xs"
          >
            <span>
              {l.slug.split("_")[0]} · {l.calls} calls · {l.step}
            </span>
            <strong>{money(l.estimate)}</strong>
          </div>
        ))}
        <p className="mt-3 text-xs text-muted-foreground">
          Maximum planned cost. Actual charges appear in your wallet.
        </p>
      </article>
    )
  }
  if (name === "connect_apps" && done && typeof output?.url === "string")
    return (
      <article className="plan-card">
        <strong>Connect {String(output.toolkit)}</strong>
        <p className="my-2 text-sm">
          Use your own account to check contacts and create approved drafts.
        </p>
        <a
          className="primary-button inline-flex"
          href={output.url}
          target="_blank"
          rel="noreferrer"
        >
          Connect securely ↗
        </a>
        <p className="mt-2 text-xs">
          Return here and select Continue when connected.
        </p>
      </article>
    )
  const data = output?.data as { call?: Call } | undefined
  const call = data?.call ?? (output?.slug ? (output as Call) : undefined)
  if (call) return <ToolCard call={call} />
  const label = name.replaceAll("_", " ").toLowerCase()
  const Icon = fail ? CircleAlert : done ? CheckCircle2 : Loader2
  return (
    <div className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
      <Icon size={14} className={!done && !fail ? "animate-spin" : ""} />
      <span className="capitalize">{label}</span>
      <span>
        ·{" "}
        {fail ? "Stopped — review run status" : done ? "Complete" : "Working…"}
      </span>
    </div>
  )
}
