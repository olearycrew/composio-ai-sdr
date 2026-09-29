import rates from "@/config/instant-rates.json"
import { usdMicros, type Step } from "./sdr"

export const WALLET_TOOLS = {
  EXA_SEARCH: {
    toolkit: "exa",
    step: "Find companies",
    action: "Search the web",
  },
  APOLLO_ORGANIZATION_SEARCH: {
    toolkit: "apollo",
    step: "Find companies",
    action: "Find companies",
  },
  FIRECRAWL_SCRAPE: {
    toolkit: "firecrawl",
    step: "Research signals",
    action: "Read company page",
  },
  APOLLO_PEOPLE_SEARCH: {
    toolkit: "apollo",
    step: "Find people",
    action: "Find decision makers",
  },
  HUNTER_DOMAIN_SEARCH: {
    toolkit: "hunter",
    step: "Find people",
    action: "Find company emails",
  },
  HUNTER_EMAIL_VERIFIER: {
    toolkit: "hunter",
    step: "Verify emails",
    action: "Verify email",
  },
  ZEROBOUNCE_VALIDATE_EMAIL: {
    toolkit: "zerobounce",
    step: "Verify emails",
    action: "Verify email",
  },
} satisfies Record<string, { toolkit: string; step: Step; action: string }>
export type WalletSlug = keyof typeof WALLET_TOOLS
export const KEYS_TOOLS = {
  HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA: "hubspot",
  HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA: "hubspot",
  SALESFORCE_EXECUTE_SOSL_SEARCH: "salesforce",
  GMAIL_FETCH_EMAILS: "gmail",
  GMAIL_CREATE_EMAIL_DRAFT: "gmail",
} as const
export const toolkits = [
  ...new Set([
    ...Object.values(WALLET_TOOLS).map((t) => t.toolkit),
    ...Object.values(KEYS_TOOLS),
  ]),
]
export const toolFilters = Object.fromEntries(
  toolkits.map((toolkit) => [
    toolkit,
    {
      enable: [
        ...Object.entries(WALLET_TOOLS)
          .filter(([, v]) => v.toolkit === toolkit)
          .map(([k]) => k),
        ...Object.entries(KEYS_TOOLS)
          .filter(([, v]) => v === toolkit)
          .map(([k]) => k),
      ],
    },
  ])
)
export function maxCharge(slug: string) {
  if (
    !rates.verifiedAt ||
    !rates.expiresAt ||
    Date.parse(rates.expiresAt) <= Date.now()
  )
    return null
  const entry = (rates.tools as Record<string, { maxUsd: string }>)[slug]
  return entry ? usdMicros(entry.maxUsd) : null
}
export function boundedArgs(
  slug: WalletSlug,
  args: Record<string, unknown>,
  target: number
) {
  const copy = { ...args }
  // Reject expensive optional modes rather than silently changing the model's request.
  switch (slug) {
    case "EXA_SEARCH": {
      const allowed = [
        "query",
        "type",
        "numResults",
        "includeDomains",
        "excludeDomains",
        "category",
        "startPublishedDate",
        "endPublishedDate",
      ]
      if (Object.keys(copy).some((k) => !allowed.includes(k)))
        throw new Error("Use basic Exa search without paid content extras.")
      copy.type = "auto"
      copy.numResults = Math.min(
        10,
        target,
        Math.max(1, Number(copy.numResults) || 10)
      )
      break
    }
    case "APOLLO_ORGANIZATION_SEARCH":
    case "APOLLO_PEOPLE_SEARCH":
      copy.per_page = Math.min(
        target,
        20,
        Math.max(1, Number(copy.per_page) || 10)
      )
      break
    case "HUNTER_DOMAIN_SEARCH":
      copy.limit = Math.min(10, target, Math.max(1, Number(copy.limit) || 5))
      break
    case "FIRECRAWL_SCRAPE": {
      if (
        Object.keys(copy).some(
          (k) => !["url", "formats", "onlyMainContent", "timeout"].includes(k)
        )
      )
        throw new Error("Only synchronous markdown scraping is enabled.")
      copy.formats = ["markdown"]
      copy.onlyMainContent = true
      copy.timeout = 30000
      const url = new URL(String(copy.url))
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        /^(localhost|127\.|10\.|192\.168\.|\[|0\.)/.test(url.hostname)
      )
        throw new Error("Use a public HTTPS company page.")
      break
    }
  }
  return copy
}
