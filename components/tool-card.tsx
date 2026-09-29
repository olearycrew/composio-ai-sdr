import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  Wallet,
} from "lucide-react"
import { BILLING_URL, money, type Call } from "@/lib/sdr"
export function ToolCard({ call }: { call: Call }) {
  const Icon =
    call.status === "pending"
      ? Loader2
      : call.status === "succeeded"
        ? CheckCircle2
        : CircleAlert
  return (
    <article
      className="tool-card"
      aria-label={`${call.provider} ${call.action}`}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={15}
          className={
            call.status === "pending" ? "animate-spin" : "text-teal-700"
          }
        />
        <strong className="capitalize">{call.provider}</strong>
        <span className={`source-badge ${call.source.toLowerCase()}`}>
          {call.source === "Wallet" ? (
            <Wallet size={11} />
          ) : (
            <KeyRound size={11} />
          )}
          {call.source}
        </span>
        <span className="ml-auto font-mono text-xs">
          {call.charge === null ? "Pending" : money(call.charge)}
        </span>
      </div>
      <p className="mt-2 text-sm">{call.action}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {call.step} ·{" "}
        {call.status === "succeeded"
          ? "Complete"
          : call.status === "uncertain"
            ? "Needs reconciliation"
            : call.status}
      </p>
      {call.error && (
        <p className="mt-2 text-xs text-amber-800">
          {call.error}{" "}
          {/top-up/i.test(call.error) && (
            <a
              href={BILLING_URL}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Add credits ↗
            </a>
          )}
        </p>
      )}
    </article>
  )
}
