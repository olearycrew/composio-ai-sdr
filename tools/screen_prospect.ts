import { tool } from "ai"
import { prospectSchema, screenProspect } from "@/lib/prospects"
export const screenProspectTool = (id: string) =>
  tool({
    description:
      "Add a verified prospect only after automatic CRM and Gmail exclusion checks succeed. Use real discovered names, titles, deliverable emails and evidence. Any matching CRM record or prior sent email excludes the prospect.",
    inputSchema: prospectSchema,
    execute: (input) => screenProspect(id, input),
  })
