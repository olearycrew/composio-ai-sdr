import type { Tool } from "@composio/core"
import { walletTool } from "@/lib/wallet-tool"
export const create = (id: string, raw: Tool) =>
  walletTool(id, "ZEROBOUNCE_VALIDATE_EMAIL", raw)
