import { tool } from "ai"
import { z } from "zod"
import { createDraft } from "@/lib/prospects"
export const createDraftTool = (id: string) =>
  tool({
    description:
      "Create a Gmail draft for an email approved by the human in the review UI. Cannot change recipient, subject or body. No sending is supported.",
    inputSchema: z.object({ proposalId: z.string() }),
    execute: ({ proposalId }) => createDraft(id, proposalId),
  })
