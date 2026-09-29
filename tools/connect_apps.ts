import { tool } from "ai"
import { z } from "zod"
import { connect } from "@/lib/composio"
export const connectApps = (id: string) =>
  tool({
    description:
      "Connect the user's Gmail and CRM. Show the returned auth link and wait for the user. Never ask for a provider API key.",
    inputSchema: z.object({
      toolkit: z.enum(["gmail", "hubspot", "salesforce"]),
    }),
    execute: ({ toolkit }) => connect(id, toolkit),
  })
