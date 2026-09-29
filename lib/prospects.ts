import { randomUUID } from "node:crypto"
import { z } from "zod"
import { executeCall, refreshConnections } from "./composio"
import { getRun, mutateRun } from "./ledger"
import type { Call, Evidence, Prospect, Run } from "./sdr"

export const domainSchema = z
  .string()
  .toLowerCase()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/)
export const evidenceSchema = z.object({
  url: z.url().refine((v) => v.startsWith("https://")),
  quote: z.string().min(10).max(1000),
  callId: z.string(),
})
export const companySchema = z.object({
  name: z.string().min(1).max(150),
  domain: domainSchema,
  country: z.string().max(80),
  employees: z.number().int().positive(),
  industry: z.string().max(200),
  signal: z.string().min(10).max(1000),
  financeAssessment: z.string().min(20).max(1000),
  fitsBrief: z.boolean(),
  hasInternalFinance: z.boolean(),
  evidence: z.array(evidenceSchema).min(2).max(10),
})
export function validateEvidence(run: Run, evidence: Evidence[]) {
  for (const item of evidence) {
    const call = run.calls.find(
      (c) => c.id === item.callId && c.status === "succeeded"
    )
    const text = JSON.stringify(call?.result ?? {}).toLowerCase()
    // URLs and verbatim quotes must exist in an actual tool response or its requested page.
    const urlFound =
      text.includes(item.url.toLowerCase()) || call?.args.url === item.url
    if (
      !call ||
      !urlFound ||
      !text.includes(JSON.stringify(item.quote.toLowerCase()).slice(1, -1))
    )
      throw new Error(
        "Evidence must cite a successful tool response and a verbatim quote."
      )
  }
}
export async function qualifyCompany(
  id: string,
  input: z.infer<typeof companySchema>
) {
  return mutateRun(id, (run) => {
    validateEvidence(run, input.evidence)
    const research = input.evidence.some(
      (e) =>
        run.calls.find((c) => c.id === e.callId)?.step === "Research signals"
    )
    if (!research)
      throw new Error(
        "Read company/team/careers evidence before qualification."
      )
    const launch =
      /bookkeeping/i.test(run.brief) && /marketing agencies/i.test(run.brief)
    const qualified =
      input.fitsBrief &&
      !input.hasInternalFinance &&
      (!launch ||
        (/^(us|usa|united states(?: of america)?)$/i.test(input.country) &&
          input.employees >= 10 &&
          input.employees <= 50))
    const prior = run.companies.find((c) => c.domain === input.domain)
    if (prior) return prior
    const company = { ...input, id: randomUUID(), qualified }
    run.companies.push(company)
    if (!qualified)
      run.skipped.push({
        company: input.name,
        reason: input.hasInternalFinance
          ? "Internal finance team found"
          : "Does not meet the brief",
      })
    return company
  })
}
export function dataLayers(
  value: Record<string, unknown>
): Record<string, unknown>[] {
  const layers = [value]
  let next = value.data
  while (
    next &&
    typeof next === "object" &&
    !Array.isArray(next) &&
    layers.length < 5
  ) {
    layers.push(next as Record<string, unknown>)
    next = (next as Record<string, unknown>).data
  }
  return layers
}
export function verified(call: Call, email: string) {
  if (
    call.status !== "succeeded" ||
    call.step !== "Verify emails" ||
    String(call.args.email).toLowerCase() !== email.toLowerCase()
  )
    return false
  return dataLayers(call.result ?? {}).some((d) => {
    if (call.slug === "ZEROBOUNCE_VALIDATE_EMAIL") return d.status === "valid"
    if (call.slug === "HUNTER_EMAIL_VERIFIER")
      return d.status === "valid" && d.result === "deliverable"
    return false
  })
}
export function searchHasMatch(call: Call): boolean {
  if (call.status !== "succeeded" || !call.result)
    throw new Error(
      "Exclusion check did not complete; this prospect cannot be approved."
    )
  for (const layer of dataLayers(call.result)) {
    for (const field of ["results", "searchRecords", "messages"]) {
      if (Array.isArray(layer[field])) {
        if ((layer[field] as unknown[]).length) return true
        if (
          layer.nextPageToken ||
          layer.paging ||
          (typeof layer.total === "number" && layer.total > 0)
        )
          throw new Error("Exclusion search is incomplete; prospect withheld.")
        return false
      }
    }
    if (
      call.slug === "GMAIL_FETCH_EMAILS" &&
      layer.resultSizeEstimate === 0 &&
      !layer.nextPageToken
    )
      return false
  }
  throw new Error("Unrecognized exclusion response; prospect withheld.")
}
export async function exclusionChecks(
  id: string,
  email: string,
  domain: string,
  companyId: string,
  companyName: string
) {
  const connections = await refreshConnections(id)
  if (
    !connections.gmail?.connected ||
    (!connections.hubspot?.connected && !connections.salesforce?.connected)
  )
    throw new Error(
      "Connect Gmail and HubSpot (or Salesforce) before screening prospects."
    )
  const calls: Call[] = []
  if (connections.hubspot?.connected) {
    calls.push(
      await executeCall(
        id,
        "HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA",
        {
          objectType: "companies",
          limit: 1,
          filterGroups: [
            {
              filters: [
                { propertyName: "name", operator: "EQ", value: companyName },
              ],
            },
            {
              filters: [
                {
                  propertyName: "domain",
                  operator: "EQ",
                  value: `www.${domain}`,
                },
              ],
            },
            {
              filters: [
                { propertyName: "domain", operator: "EQ", value: domain },
              ],
            },
          ],
        },
        "Check CRM",
        companyId
      )
    )
    calls.push(
      await executeCall(
        id,
        "HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA",
        {
          limit: 1,
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: "EQ", value: email },
              ],
            },
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "CONTAINS_TOKEN",
                  value: `*@${domain}`,
                },
              ],
            },
          ],
        },
        "Check CRM",
        companyId
      )
    )
  } else {
    // Values are validated as plain addresses/domains; escape SOSL reserved punctuation.
    const escape = (s: string) =>
      s.replace(/([?&|!{}\[\]()^~*:\\"'+-])/g, "\\$1")
    calls.push(
      await executeCall(
        id,
        "SALESFORCE_EXECUTE_SOSL_SEARCH",
        {
          q: `FIND {${escape(domain)}} IN ALL FIELDS RETURNING Account(Id), Contact(Id), Lead(Id) LIMIT 1`,
        },
        "Check CRM",
        companyId
      )
    )
    calls.push(
      await executeCall(
        id,
        "SALESFORCE_EXECUTE_SOSL_SEARCH",
        {
          q: `FIND {${escape(email)}} IN EMAIL FIELDS RETURNING Contact(Id), Lead(Id) LIMIT 1`,
        },
        "Check CRM",
        companyId
      )
    )
  }
  for (const call of calls)
    if (searchHasMatch(call))
      return { excluded: true, reason: "Already in CRM", calls }
  // Search both address and domain, including cc/bcc and trashed sent mail.
  const mail = await executeCall(
    id,
    "GMAIL_FETCH_EMAILS",
    {
      user_id: "me",
      query: `in:sent {to:${email} cc:${email} bcc:${email} to:${domain} cc:${domain} bcc:${domain}}`,
      max_results: 1,
      ids_only: true,
      include_payload: false,
      include_spam_trash: true,
    },
    "Check sent mail",
    companyId
  )
  calls.push(mail)
  return {
    excluded: searchHasMatch(mail),
    reason: "Previously contacted in Gmail",
    calls,
  }
}
export const prospectSchema = z.object({
  companyId: z.string(),
  person: z.string().min(2).max(100),
  title: z.string().min(2).max(150),
  email: z
    .email()
    .toLowerCase()
    .refine((v) => /^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(v)),
  evidence: z.array(evidenceSchema).min(1).max(5),
  verificationCallId: z.string(),
})
export async function screenProspect(
  id: string,
  input: z.infer<typeof prospectSchema>
) {
  const run = await getRun(id)
  const prior = run.prospects.find((p) => p.email === input.email)
  if (prior) return prior
  if (run.prospects.length >= run.target)
    throw new Error("Prospect target reached")
  const company = run.companies.find(
    (c) => c.id === input.companyId && c.qualified
  )
  if (!company || !input.email.endsWith(`@${company.domain}`))
    throw new Error(
      "A qualified company and matching email domain are required"
    )
  validateEvidence(run, input.evidence)
  const verification = run.calls.find((c) => c.id === input.verificationCallId)
  if (!verification || !verified(verification, input.email))
    throw new Error("Only verified deliverable emails can enter the results")
  const checks = await exclusionChecks(
    id,
    input.email,
    company.domain,
    company.id,
    company.name
  )
  return mutateRun(id, (state) => {
    if (checks.excluded) {
      state.skipped.push({ company: company.name, reason: checks.reason })
      return { excluded: true, reason: checks.reason }
    }
    if (state.prospects.length >= state.target)
      throw new Error("Prospect target reached")
    const duplicate = state.prospects.find((p) => p.email === input.email)
    if (duplicate) return duplicate
    const prospect: Prospect = {
      ...input,
      id: randomUUID(),
      screeningCallIds: checks.calls.map((c) => c.id),
      checkedAt: new Date().toISOString(),
    }
    state.prospects.push(prospect)
    return prospect
  })
}
export async function createDraft(id: string, proposalId: string) {
  const run = await getRun(id)
  const proposal = run.proposals.find((p) => p.id === proposalId)
  if (!proposal || proposal.status !== "approved")
    throw new Error("Only a human-approved email can become a Gmail draft")
  const prospect = run.prospects.find((p) => p.id === proposal.prospectId)!
  // Never reuse old exclusion evidence indefinitely; stop instead of violating session deduplication.
  if (Date.now() - Date.parse(prospect.checkedAt) > 30 * 60_000)
    throw new Error(
      "Exclusion checks are older than 30 minutes. Start a fresh session before drafting."
    )
  if (
    prospect.screeningCallIds.some(
      (callId) =>
        !run.calls.some((c) => c.id === callId && c.status === "succeeded")
    )
  )
    throw new Error("Exclusion checks are incomplete")
  await refreshConnections(id)
  const call = await executeCall(
    id,
    "GMAIL_CREATE_EMAIL_DRAFT",
    {
      user_id: "me",
      recipient_email: prospect.email,
      subject: proposal.subject,
      body: proposal.body,
      is_html: false,
    },
    "Create drafts",
    prospect.companyId
  )
  const draftId = dataLayers(call.result ?? {})
    .map((d) => d.id)
    .find((v) => typeof v === "string")
  await mutateRun(id, (state) => {
    const p = state.proposals.find((p) => p.id === proposalId)!
    if (call.status === "succeeded" && typeof draftId === "string") {
      p.status = "drafted"
      p.draftId = draftId
    } else if (
      call.status === "uncertain" ||
      call.status === "pending" ||
      call.status === "succeeded"
    )
      p.status = "uncertain"
  })
  return call
}
