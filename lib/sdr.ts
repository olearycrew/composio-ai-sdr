import type { UIMessage } from "ai"

export const LAUNCH_BRIEF =
  "We sell bookkeeping services to US marketing agencies with 10 to 50 employees. Find founders or operations leads at agencies that are growing but don't have an internal finance team. Offer a 20-minute consultation. Prioritize companies hiring or recently funded. Exclude existing customers and anyone we've already contacted. Start with 20 prospects. Show me the first five emails before sending. Spend up to $25 on research and enrichment."
export const BILLING_URL = "https://platform.composio.dev/settings/billing"
export const STEPS = [
  "Find companies",
  "Research signals",
  "Find people",
  "Verify emails",
  "Check CRM",
  "Check sent mail",
  "Create drafts",
] as const
export type Step = (typeof STEPS)[number]
export type Call = {
  id: string
  key: string
  slug: string
  provider: string
  action: string
  source: "Wallet" | "Keys"
  step: Step
  companyId?: string
  status: "pending" | "succeeded" | "failed" | "uncertain"
  reserved: number
  charge: number | null
  at: string
  result?: Record<string, unknown>
  error?: string
  logId?: string
  args: Record<string, unknown>
}
export type Evidence = { url: string; quote: string; callId: string }
export type Company = {
  id: string
  name: string
  domain: string
  country: string
  employees: number
  industry: string
  signal: string
  financeAssessment: string
  qualified: boolean
  evidence: Evidence[]
}
export type Prospect = {
  id: string
  companyId: string
  person: string
  title: string
  email: string
  evidence: Evidence[]
  verificationCallId: string
  screeningCallIds: string[]
  checkedAt: string
}
export type Proposal = {
  id: string
  prospectId: string
  subject: string
  body: string
  status: "pending" | "approved" | "rejected" | "drafted" | "uncertain"
  draftId?: string
}
export type Plan = {
  summary: string
  lines: { slug: string; calls: number; step: Step; estimate: number }[]
}
export type CatalogEntry = {
  slug: string
  toolkit: string
  instant: boolean
  maxCharge: number | null
  description: string
  schema: Record<string, unknown>
}
export type Run = {
  id: string
  userId: string
  brief: string
  budget: number
  target: number
  reviewCount: number
  status: "ready" | "researching" | "awaiting_review" | "complete" | "blocked"
  sessionId?: string
  sessionCreating?: boolean
  catalog: CatalogEntry[]
  connections: Record<
    string,
    { connected: boolean; accountId?: string; url?: string }
  >
  plans: Plan[]
  calls: Call[]
  companies: Company[]
  prospects: Prospect[]
  proposals: Proposal[]
  skipped: { company: string; reason: string }[]
  messages: UIMessage[]
  note?: string
  walletBalance: number | null
  activeRequest?: { id: string; at: number }
  createdAt: string
}
export const dollars = (micros: number) => micros / 1_000_000
export const money = (micros: number) =>
  dollars(micros).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
export const spent = (run: Run) =>
  run.calls.reduce((n, c) => n + (c.charge ?? 0), 0)
export const reserved = (run: Run) =>
  run.calls.reduce((n, c) => n + (c.charge === null ? c.reserved : 0), 0)
export function usdMicros(value: unknown): number {
  const text = String(value)
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error("Invalid USD amount")
  const [whole, fraction = ""] = text.split(".")
  const micros = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"))
  if (!Number.isSafeInteger(micros)) throw new Error("USD amount is too large")
  return micros
}
export function parseBrief(brief: string) {
  const budgetMatches = [
    ...brief.matchAll(
      /(?:spend(?:\s+up\s+to)?|budget(?:\s+of)?|maximum(?:\s+of)?|up\s+to)\s*:?\s*\$\s*(\d+(?:\.\d{1,2})?)/gi
    ),
  ]
  const budget = budgetMatches.length
    ? Math.min(...budgetMatches.map((m) => usdMicros(m[1])))
    : 5_000_000
  const count = brief.match(
    /(?:start\s+with|find|target(?:\s+of)?)\s+(\d+)\s+(?:prospects?|leads?|people|contacts?)/i
  )
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    ten: 10,
  }
  const review = brief.match(
    /first\s+(\d+|one|two|three|four|five|ten)\s+emails?/i
  )
  const target = count ? Number(count[1]) : 20
  if (budget > 100_000_000 || target < 1 || target > 100)
    throw new Error(
      "This demo supports budgets up to $100 and 1–100 prospects."
    )
  return {
    budget,
    target,
    reviewCount: Math.min(
      target,
      review ? (words[review[1].toLowerCase()] ?? Number(review[1])) : 5
    ),
  }
}
export function newRun(id: string, userId: string, brief: string): Run {
  return {
    id,
    userId,
    brief,
    ...parseBrief(brief),
    status: "ready",
    catalog: [],
    connections: {},
    plans: [],
    calls: [],
    companies: [],
    prospects: [],
    proposals: [],
    skipped: [],
    messages: [],
    walletBalance: null,
    createdAt: new Date().toISOString(),
  }
}
