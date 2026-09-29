"use client"
import { isToolUIPart, getToolName } from "ai"
import type { ChatUIMessage } from "@/tools"
import { TextPart } from "./parts/text-part"
import { SourcesPart } from "./parts/sources-part"
import { AskUserPart } from "./parts/ask-user-part"
import { PlanResearchPart } from "./parts/plan-research-part"
import { DiscoverToolsPart } from "./parts/discover-tools-part"
import { ConnectAppsPart } from "./parts/connect-apps-part"
import { QualifyCompanyPart } from "./parts/qualify-company-part"
import { ScreenProspectPart } from "./parts/screen-prospect-part"
import { CreateDraftPart } from "./parts/create-draft-part"
import { FinishRunPart } from "./parts/finish-run-part"
import { ExaSearchPart } from "./parts/exa-search-part"
import { ApolloOrganizationSearchPart } from "./parts/apollo-organization-search-part"
import { FirecrawlScrapePart } from "./parts/firecrawl-scrape-part"
import { ApolloPeopleSearchPart } from "./parts/apollo-people-search-part"
import { HunterDomainSearchPart } from "./parts/hunter-domain-search-part"
import { HunterEmailVerifierPart } from "./parts/hunter-email-verifier-part"
import { ZerobounceValidateEmailPart } from "./parts/zerobounce-validate-email-part"
const renderers = {
  ask_user: AskUserPart,
  plan_research: PlanResearchPart,
  discover_tools: DiscoverToolsPart,
  connect_apps: ConnectAppsPart,
  qualify_company: QualifyCompanyPart,
  screen_prospect: ScreenProspectPart,
  create_draft: CreateDraftPart,
  finish_run: FinishRunPart,
  EXA_SEARCH: ExaSearchPart,
  APOLLO_ORGANIZATION_SEARCH: ApolloOrganizationSearchPart,
  FIRECRAWL_SCRAPE: FirecrawlScrapePart,
  APOLLO_PEOPLE_SEARCH: ApolloPeopleSearchPart,
  HUNTER_DOMAIN_SEARCH: HunterDomainSearchPart,
  HUNTER_EMAIL_VERIFIER: HunterEmailVerifierPart,
  ZEROBOUNCE_VALIDATE_EMAIL: ZerobounceValidateEmailPart,
}
export function ChatMessage({
  message,
  isStreaming = false,
}: {
  message: ChatUIMessage
  isStreaming?: boolean
}) {
  return (
    <article
      className={message.role === "user" ? "user-message" : "assistant-message"}
    >
      {message.role === "assistant" && (
        <div className="eyebrow mb-3">Composio AI SDR</div>
      )}
      {message.parts.map((part, i) => {
        if (part.type === "text") return <TextPart key={i} part={part} />
        if (isToolUIPart(part)) {
          const Component =
            renderers[getToolName(part) as keyof typeof renderers]
          return Component ? (
            <Component key={part.toolCallId} part={part} />
          ) : null
        }
        return null
      })}
      {!isStreaming && <SourcesPart parts={message.parts} />}
    </article>
  )
}
