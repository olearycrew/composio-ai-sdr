import { tool } from "ai"
import { z } from "zod"
import { mutateRun } from "@/lib/ledger"
import { spent } from "@/lib/sdr"
export const finishRun = (id: string) =>
  tool({
    description:
      "Finish research with a clear reason if fewer prospects were found. Summarize provider costs and skips from server totals. If prospects exist, first prepare email previews using ask_user.",
    inputSchema: z.object({ reason: z.string().min(10).max(2000) }),
    execute: ({ reason }) =>
      mutateRun(id, (run) => {
        if (
          run.prospects.length &&
          run.proposals.length < Math.min(run.reviewCount, run.prospects.length)
        )
          throw new Error(
            "Prepare email previews with ask_user before finishing"
          )
        run.note = reason
        run.status = run.proposals.some((p) => p.status === "pending")
          ? "awaiting_review"
          : "complete"
        return {
          found: run.prospects.length,
          target: run.target,
          spent: spent(run),
          providers: Object.fromEntries(
            [...new Set(run.calls.map((c) => c.provider))].map((p) => [
              p,
              run.calls
                .filter((c) => c.provider === p)
                .reduce((s, c) => s + (c.charge ?? 0), 0),
            ])
          ),
          skipped: run.skipped,
          reason,
        }
      }),
  })
