import { Composio, type Tool } from "@composio/core"
import { VercelProvider } from "@composio/vercel"
import {
  WALLET_TOOLS,
  KEYS_TOOLS,
  toolFilters,
  toolkits,
  maxCharge,
  boundedArgs,
  type WalletSlug,
} from "./catalog"
import { getRun, mutateRun, reserveCall, settleCall } from "./ledger"
import { usdMicros, type Run, type Step, type Call } from "./sdr"

export const provider = new VercelProvider()
let client: Composio<VercelProvider> | undefined
export function composio() {
  if (!process.env.COMPOSIO_API_KEY)
    throw new Error(
      "Add COMPOSIO_API_KEY to enable your connected apps and research wallet."
    )
  return (client ??= new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
    provider,
  }))
}
// SDK terminology is isolated here. Premium names are not aliases in core 0.22.
export const instantConfig = {
  toolkits: {
    enable: [...new Set(Object.values(WALLET_TOOLS).map((t) => t.toolkit))],
  },
  tools: Object.fromEntries(
    Object.entries(toolFilters).filter(
      ([k]) => !["gmail", "hubspot", "salesforce"].includes(k)
    )
  ),
  returnInstantCharge: true,
}
export async function sessionFor(id: string) {
  const run = await getRun(id)
  if (run.sessionId) return composio().use(run.sessionId)
  await mutateRun(id, (state) => {
    if (state.sessionId || state.sessionCreating)
      throw new Error(
        "Session setup is already in progress. Refresh the run shortly."
      )
    state.sessionCreating = true
  })
  try {
    const session = await composio().create(run.userId, {
      toolkits,
      tools: toolFilters,
      instant: instantConfig,
      manageConnections: false,
    })
    await mutateRun(id, (state) => {
      state.sessionId = session.sessionId
      state.sessionCreating = false
    })
    return session
  } catch (error) {
    // A timeout may have created the session; do not create another blindly.
    await mutateRun(id, (state) => {
      state.note =
        "Session setup did not finish. Check Composio session logs before retrying."
    })
    throw error
  }
}
export async function discover(id: string) {
  const session = await sessionFor(id)
  const rawTools: Tool[] = []
  const catalog: Run["catalog"] = []
  for (const toolkit of [
    ...new Set(Object.values(WALLET_TOOLS).map((v) => v.toolkit)),
  ]) {
    const search = await session.search({
      query:
        "Find companies and decision makers, research hiring and funding, verify email addresses",
      toolkits: [toolkit],
    })
    if (!search.success)
      throw new Error(
        "Tool discovery failed. Research is disabled until coverage can be verified."
      )
    const allowed =
      search.toolkitConnectionStatuses.find((s) => s.toolkit === toolkit)
        ?.instantAccount?.allowedToolSlugs ?? []
    const slugs = Object.entries(WALLET_TOOLS)
      .filter(([, t]) => t.toolkit === toolkit)
      .map(([slug]) => slug)
    const listed = await composio().tools.getRawComposioTools({ tools: slugs })
    for (const tool of listed) {
      if (!slugs.includes(tool.slug)) continue
      rawTools.push(tool)
      catalog.push({
        slug: tool.slug,
        toolkit,
        instant: allowed.includes(tool.slug),
        maxCharge: maxCharge(tool.slug),
        description: tool.description ?? tool.name,
        schema: tool.inputParameters ?? {},
      })
    }
  }
  await mutateRun(id, (run) => {
    run.catalog = catalog
  })
  await refreshConnections(id)
  return rawTools
}
export async function refreshConnections(id: string) {
  const session = await sessionFor(id)
  const statuses = await session.toolkits({
    toolkits: ["gmail", "hubspot", "salesforce"],
  })
  return mutateRun(id, (run) => {
    for (const item of statuses.items)
      run.connections[item.slug] = {
        ...run.connections[item.slug],
        connected: item.connection?.isActive ?? false,
        accountId: item.connection?.connectedAccount?.id,
      }
    return run.connections
  })
}
export async function connect(
  id: string,
  toolkit: "gmail" | "hubspot" | "salesforce"
) {
  const connections = await refreshConnections(id)
  if (connections[toolkit]?.connected) return { connected: true, toolkit }
  if (connections[toolkit]?.url)
    return { connected: false, toolkit, url: connections[toolkit].url }
  const session = await sessionFor(id)
  const request = await session.authorize(toolkit)
  await mutateRun(id, (run) => {
    run.connections[toolkit] = {
      connected: false,
      url: request.redirectUrl ?? undefined,
    }
  })
  return { connected: false, toolkit, url: request.redirectUrl }
}
export function parseCharge(value: unknown): number | null {
  if (!value || typeof value !== "object") return null
  const charge = value as { amount?: unknown; currency?: unknown }
  if (charge.currency !== "USD") return null
  try {
    return usdMicros(charge.amount)
  } catch {
    return null
  }
}
export function payloadFailure(data: Record<string, unknown>): boolean {
  if (data.successful === false || data.success === false || data.error)
    return true
  const inner = data.data
  return (
    !!inner &&
    typeof inner === "object" &&
    payloadFailure(inner as Record<string, unknown>)
  )
}
function publicError(raw: string) {
  if (/402|insufficient|balance|credits|payment.required/i.test(raw))
    return "Your Composio wallet needs a top-up. Add credits, then continue."
  if (/connect|auth|401|403/i.test(raw))
    return "The app connection needs attention. Reconnect it to continue."
  return "The provider could not complete this call. Review the available results before continuing."
}
export async function executeCall(
  id: string,
  slug: string,
  args: Record<string, unknown>,
  step: Step,
  companyId?: string
): Promise<Call> {
  const run = await getRun(id)
  const wallet = WALLET_TOOLS[slug as WalletSlug]
  const keyToolkit = KEYS_TOOLS[slug as keyof typeof KEYS_TOOLS]
  if (!wallet && !keyToolkit) throw new Error("Tool is not permitted.")
  let cap = 0
  if (wallet) {
    const entry = run.catalog.find((t) => t.slug === slug)
    if (!entry?.instant || entry.maxCharge === null || maxCharge(slug) === null)
      throw new Error(
        "This tool does not have verified Instant coverage and current pricing. Use another available tool or finish with a clear reason."
      )
    cap = maxCharge(slug)!
    args = boundedArgs(
      slug as WalletSlug,
      args,
      run.target - run.prospects.length
    )
    const company = run.companies.find((c) => c.id === companyId)
    if (["Find people", "Verify emails"].includes(step) && !company?.qualified)
      throw new Error(
        "Qualify the company against the brief before enriching or verifying people."
      )
    if (step === "Find people" && company) {
      if (slug === "HUNTER_DOMAIN_SEARCH" && args.domain !== company.domain)
        throw new Error("Domain must match the qualified company.")
      if (
        slug === "APOLLO_PEOPLE_SEARCH" &&
        JSON.stringify(args.q_organization_domains) !==
          JSON.stringify([company.domain])
      )
        throw new Error("Search only the qualified company's domain.")
    }
    if (step === "Verify emails") {
      const email = String(args.email ?? "").toLowerCase()
      if (
        !company ||
        !email.endsWith(`@${company.domain}`) ||
        !run.calls.some(
          (c) =>
            c.companyId === company.id &&
            c.step === "Find people" &&
            c.status === "succeeded" &&
            JSON.stringify(c.result).toLowerCase().includes(email)
        )
      )
        throw new Error(
          "Verify only a discovered email from this shortlisted company."
        )
    }
  } else if (
    !run.connections[keyToolkit]?.connected ||
    !run.connections[keyToolkit]?.accountId
  )
    throw new Error(`Connect ${keyToolkit} before continuing.`)
  const ticket = await reserveCall(id, {
    slug,
    args,
    provider: wallet?.toolkit ?? keyToolkit,
    action: wallet?.action ?? slug.toLowerCase().replaceAll("_", " "),
    source: wallet ? "Wallet" : "Keys",
    step,
    maxCharge: cap,
    companyId,
  })
  if (ticket.cached) return ticket.call
  try {
    const session = await sessionFor(id)
    const result = await session.execute(slug, args, {
      account: wallet
        ? "instant_account"
        : run.connections[keyToolkit].accountId,
    })
    const failure = !!result.error || payloadFailure(result.data)
    const charge = wallet ? parseCharge(result.instantCharge) : 0
    if (failure) {
      // An explicit provider failure with no charge is $0; never conceal a billed failure.
      const disputed = charge !== null && charge > 0
      return settleCall(id, ticket.call.id, {
        status: disputed ? "uncertain" : "failed",
        charge: disputed ? charge : 0,
        error: publicError(result.error ?? JSON.stringify(result.data)),
        logId: result.logId,
      })
    }
    return settleCall(id, ticket.call.id, {
      status: charge === null ? "uncertain" : "succeeded",
      charge,
      result: result.data,
      logId: result.logId,
      error:
        charge === null
          ? "Charge metadata is missing. Research paused until the charge is reconciled."
          : undefined,
    })
  } catch {
    return settleCall(id, ticket.call.id, {
      status: "uncertain",
      charge: null,
      error:
        "The response was interrupted. The call may have completed; it will not be retried automatically.",
    })
  }
}
