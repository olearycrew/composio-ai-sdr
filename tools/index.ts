import type { ToolSet, UIMessage } from "ai"
import type { Tool } from "@composio/core"
import { getRun } from "@/lib/ledger"
import { WALLET_TOOLS, type WalletSlug } from "@/lib/catalog"
import { create as wallet0 } from "./EXA_SEARCH"
import { create as wallet1 } from "./APOLLO_ORGANIZATION_SEARCH"
import { create as wallet2 } from "./FIRECRAWL_SCRAPE"
import { create as wallet3 } from "./APOLLO_PEOPLE_SEARCH"
import { create as wallet4 } from "./HUNTER_DOMAIN_SEARCH"
import { create as wallet5 } from "./HUNTER_EMAIL_VERIFIER"
import { create as wallet6 } from "./ZEROBOUNCE_VALIDATE_EMAIL"
import { askUser } from "./ask_user"
import { planResearch } from "./plan_research"
import { discoverTools } from "./discover_tools"
import { connectApps } from "./connect_apps"
import { qualifyCompanyTool } from "./qualify_company"
import { screenProspectTool } from "./screen_prospect"
import { createDraftTool } from "./create_draft"
import { finishRun } from "./finish_run"

const walletFactories = {
  EXA_SEARCH: wallet0,
  APOLLO_ORGANIZATION_SEARCH: wallet1,
  FIRECRAWL_SCRAPE: wallet2,
  APOLLO_PEOPLE_SEARCH: wallet3,
  HUNTER_DOMAIN_SEARCH: wallet4,
  HUNTER_EMAIL_VERIFIER: wallet5,
  ZEROBOUNCE_VALIDATE_EMAIL: wallet6,
}
export async function getTools(id: string): Promise<ToolSet> {
  const run = await getRun(id)
  const tools: ToolSet = {
    ask_user: askUser(id),
    plan_research: planResearch(id),
    discover_tools: discoverTools(id),
    connect_apps: connectApps(id),
    qualify_company: qualifyCompanyTool(id),
    screen_prospect: screenProspectTool(id),
    create_draft: createDraftTool(id),
    finish_run: finishRun(id),
  }
  for (const entry of run.catalog) {
    if (
      !entry.instant ||
      entry.maxCharge === null ||
      !(entry.slug in WALLET_TOOLS)
    )
      continue
    const raw: Tool = {
      slug: entry.slug,
      name: entry.slug,
      description: entry.description,
      inputParameters: entry.schema as Tool["inputParameters"],
    }
    tools[entry.slug] = walletFactories[entry.slug as WalletSlug](id, raw)
  }
  return tools
}
export type ChatUIMessage = UIMessage
export type ChatMessagePart = UIMessage["parts"][number]
export type TextMessagePart = Extract<ChatMessagePart, { type: "text" }>
export type SourceUrlPart = Extract<ChatMessagePart, { type: "source-url" }>
