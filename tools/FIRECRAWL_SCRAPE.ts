import type { Tool } from "@composio/core"
import { walletTool } from "@/lib/wallet-tool"
export const create = (id: string, raw: Tool) =>
  walletTool(id, "FIRECRAWL_SCRAPE", raw)
