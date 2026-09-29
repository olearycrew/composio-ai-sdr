import { tool } from "ai"
import { z } from "zod"
import { discover } from "@/lib/composio"
import { getRun } from "@/lib/ledger"
export const discoverTools = (id: string) =>
  tool({
    description:
      "Discover live schemas, Instant eligibility, confirmed prices and connections. No research is executed. Wallet tools become available next turn. If none are usable, finish with a clear setup reason.",
    inputSchema: z.object({}),
    execute: async () => {
      await discover(id)
      const run = await getRun(id)
      return { catalog: run.catalog, connections: run.connections }
    },
  })
