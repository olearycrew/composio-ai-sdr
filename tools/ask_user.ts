import { randomUUID } from "node:crypto"
import { tool } from "ai"
import { z } from "zod"
import { mutateRun } from "@/lib/ledger"
export const askUser = (id: string) =>
  tool({
    description:
      "Ask the human to approve, edit or reject email previews. No Gmail drafts are created here. Pause after calling. Reference screened prospect IDs and personalize factual outreach using their evidence and the user's offer.",
    inputSchema: z.object({
      emails: z
        .array(
          z.object({
            prospectId: z.string(),
            subject: z.string().min(1).max(200),
            body: z.string().min(20).max(5000),
          })
        )
        .min(1)
        .max(20),
    }),
    execute: ({ emails }) =>
      mutateRun(id, (run) => {
        if (run.proposals.length) return { proposals: run.proposals }
        const required = Math.min(run.reviewCount, run.prospects.length)
        if (emails.length !== required)
          throw new Error(
            `Prepare exactly ${required} emails for the available screened prospects`
          )
        if (
          new Set(emails.map((e) => e.prospectId)).size !== emails.length ||
          emails.some((e) => !run.prospects.some((p) => p.id === e.prospectId))
        )
          throw new Error("Use distinct screened prospects only")
        run.proposals = emails.map((e) => ({
          ...e,
          id: randomUUID(),
          status: "pending" as const,
        }))
        run.status = "awaiting_review"
        return { proposals: run.proposals }
      }),
  })
