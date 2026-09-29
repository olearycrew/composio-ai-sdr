import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
process.env.SDR_DATA_DIR = mkdtempSync(join(tmpdir(), "sdr-test-"))
const { newRun, parseBrief, LAUNCH_BRIEF, usdMicros, spent, reserved } =
  await import("../lib/sdr")
const { update, read } = await import("../lib/store")
const { reserveCall, settleCall, getRun, mutateRun, callKey } =
  await import("../lib/ledger")
const { verified, searchHasMatch, createDraft, validateEvidence } =
  await import("../lib/prospects")
const { saveReview } = await import("../lib/approval")
const { parseCharge } = await import("../lib/composio")
const { boundedArgs, toolFilters } = await import("../lib/catalog")
const { getTools } = await import("../tools")
import type { Call, Run } from "../lib/sdr"
async function seed(budget = 1_000_000) {
  const run = newRun(randomUUID(), "user", LAUNCH_BRIEF)
  run.budget = budget
  run.plans = [
    {
      summary: "Test planned search",
      lines: [
        {
          slug: "EXA_SEARCH",
          calls: 10,
          step: "Find companies",
          estimate: 1_000_000,
        },
      ],
    },
  ]
  await update<Run, void>(`run:${run.id}`, () => ({
    state: run,
    result: undefined,
  }))
  return run
}
const request = (query: string, maxCharge = 600_000) => ({
  slug: "EXA_SEARCH",
  args: { query },
  provider: "exa",
  action: "Search",
  source: "Wallet" as const,
  step: "Find companies" as const,
  maxCharge,
})
test("launch brief constraints and exact microdollar accounting", () => {
  assert.deepEqual(parseBrief(LAUNCH_BRIEF), {
    budget: 25_000_000,
    target: 20,
    reviewCount: 5,
  })
  assert.equal(parseBrief("Find 3 prospects for our agency").budget, 5_000_000)
  assert.equal(parseBrief("Find 5 prospects. Budget: $0.25").budget, 250_000)
  assert.equal(usdMicros("0.000001"), 1)
  assert.equal(
    parseCharge({
      amount: "0.012345",
      currency: "USD",
      charged_by: "composio",
    }),
    12345
  )
  assert.equal(parseCharge({ amount: "1", currency: "CREDITS" }), null)
  assert.equal(parseCharge(undefined), null)
  assert.throws(() => usdMicros("NaN"))
})
test("concurrent calls cannot reserve beyond budget; lower actual charge frees funds", async () => {
  const run = await seed()
  const attempts = await Promise.allSettled([
    reserveCall(run.id, request("a")),
    reserveCall(run.id, request("b")),
  ])
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1)
  const state = await getRun(run.id)
  assert.equal(reserved(state), 600_000)
  await settleCall(run.id, state.calls[0].id, {
    status: "succeeded",
    charge: 200_000,
    result: { results: [] },
  })
  await reserveCall(run.id, request("c"))
  const after = await getRun(run.id)
  assert.equal(spent(after), 200_000)
  assert.equal(reserved(after), 600_000)
  assert.ok(spent(after) + reserved(after) <= after.budget)
})
test("canonical per-session cache deduplicates successes, failures and in-flight calls", async () => {
  assert.equal(callKey("T", { b: 2, a: 1 }), callKey("T", { a: 1, b: 2 }))
  const run = await seed()
  const a = await reserveCall(run.id, request("same"))
  const b = await reserveCall(run.id, request("same"))
  assert.equal(b.cached, true)
  assert.equal(a.call.id, b.call.id)
  await settleCall(run.id, a.call.id, {
    status: "failed",
    charge: 0,
    error: "No results",
  })
  assert.equal((await reserveCall(run.id, request("same"))).cached, true)
  assert.equal((await getRun(run.id)).calls.length, 1)
  assert.equal(spent(await getRun(run.id)), 0)
})
test("no plan, exhausted count and unresolved charges stop wallet spending", async () => {
  const run = await seed()
  await mutateRun(run.id, (r) => {
    r.plans = []
  })
  await assert.rejects(
    reserveCall(run.id, request("no plan")),
    /Publish a plan/
  )
  await mutateRun(run.id, (r) => {
    r.plans = run.plans
  })
  const ticket = await reserveCall(run.id, request("uncertain"))
  await settleCall(run.id, ticket.call.id, {
    status: "uncertain",
    charge: null,
  })
  await assert.rejects(
    reserveCall(run.id, request("new")),
    /stopped|unresolved/
  )
  assert.equal(reserved(await getRun(run.id)), 600_000)
})
const baseCall: Call = {
  id: "call",
  key: "key",
  slug: "GMAIL_FETCH_EMAILS",
  provider: "gmail",
  action: "Check sent",
  source: "Keys",
  step: "Check sent mail",
  status: "succeeded",
  reserved: 0,
  charge: 0,
  at: new Date().toISOString(),
  args: {},
}
test("exclusions fail closed and never treat incomplete or error responses as clear", () => {
  assert.equal(
    searchHasMatch({
      ...baseCall,
      result: { data: { messages: [{ id: "already-contacted" }] } },
    }),
    true
  )
  assert.equal(
    searchHasMatch({
      ...baseCall,
      result: { data: { messages: [], resultSizeEstimate: 0 } },
    }),
    false
  )
  assert.equal(
    searchHasMatch({
      ...baseCall,
      slug: "HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA",
      result: { results: [{ id: "customer" }] },
    }),
    true
  )
  assert.throws(() =>
    searchHasMatch({
      ...baseCall,
      result: { messages: [], nextPageToken: "next" },
    })
  )
  assert.throws(() => searchHasMatch({ ...baseCall, result: {} }))
  assert.throws(() =>
    searchHasMatch({ ...baseCall, status: "failed", result: { messages: [] } })
  )
})
test("only deliverable emails with matching verification inputs qualify", () => {
  const call: Call = {
    ...baseCall,
    slug: "HUNTER_EMAIL_VERIFIER",
    step: "Verify emails",
    args: { email: "founder@example.com" },
    result: { data: { status: "valid", result: "deliverable" } },
  }
  assert.equal(verified(call, "founder@example.com"), true)
  assert.equal(verified(call, "someone@example.com"), false)
  assert.equal(
    verified(
      { ...call, result: { data: { status: "accept_all", result: "risky" } } },
      "founder@example.com"
    ),
    false
  )
})
test("evidence quotes must exist in successful tool results", async () => {
  const run = await seed()
  run.calls = [
    {
      ...baseCall,
      result: {
        url: "https://example.com/team",
        text: "We are hiring an account director",
      },
    },
  ]
  validateEvidence(run, [
    {
      url: "https://example.com/team",
      quote: "We are hiring an account director",
      callId: "call",
    },
  ])
  assert.throws(() =>
    validateEvidence(run, [
      {
        url: "https://example.com/team",
        quote: "We raised ten million dollars",
        callId: "call",
      },
    ])
  )
})
test("approval ownership, edits, replay and unapproved drafts are enforced on server", async () => {
  const run = await seed()
  const pid = randomUUID()
  await mutateRun(run.id, (r) => {
    r.proposals.push({
      id: pid,
      prospectId: "p",
      subject: "Original",
      body: "Original outreach body long enough",
      status: "pending",
    })
  })
  await assert.rejects(createDraft(run.id, pid), /human-approved/)
  const decision = {
    runId: run.id,
    proposalId: pid,
    decision: "approve" as const,
    subject: "Human edit",
    body: "This is the human edited email body.",
  }
  await assert.rejects(saveReview("another-user", decision), /not found/)
  await saveReview("user", decision)
  const saved = (await getRun(run.id)).proposals[0]
  assert.equal(saved.subject, "Human edit")
  assert.equal(saved.status, "approved")
  await assert.rejects(saveReview("user", decision), /already been reviewed/)
})
test("expensive extras are rejected, searches capped, and no send path is exposed", async () => {
  assert.equal(
    boundedArgs(
      "EXA_SEARCH",
      { query: "agencies", type: "deep", numResults: 100 },
      20
    ).numResults,
    10
  )
  assert.equal(
    boundedArgs("EXA_SEARCH", { query: "agencies", type: "deep" }, 20).type,
    "auto"
  )
  assert.throws(() =>
    boundedArgs(
      "EXA_SEARCH",
      { query: "agencies", contents: { text: true } },
      20
    )
  )
  const tools = await getTools((await seed()).id)
  assert.ok(!Object.keys(tools).some((k) => /send/i.test(k)))
  assert.ok(
    !Object.values(toolFilters)
      .flatMap((v) => v.enable)
      .some((k) => /SEND/.test(k))
  )
  assert.equal(await read("does-not-exist"), null)
})

test("target count and fully spent budget block even a zero-priced wallet call", async () => {
  const run = await seed()
  await mutateRun(run.id, (r) => {
    r.target = 0
  })
  await assert.rejects(reserveCall(run.id, request("target", 0)), /stopped/)
  await mutateRun(run.id, (r) => {
    r.target = 20
    r.budget = 0
  })
  await assert.rejects(reserveCall(run.id, request("spent", 0)), /Budget limit/)
})
