import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"
const base = process.env.SDR_TEST_URL ?? "http://127.0.0.1:3000"
const browser = await chromium.launch({ headless: true })
const results = []
await mkdir("/tmp/sdr-browser", { recursive: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(base, { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Prospects 0/20" }).waitFor()
  await page.getByRole("button", { name: "Prospects 0/20" }).click()
  await page.getByText("Start with your sales brief").waitFor()
  await page.getByRole("button", { name: "Conversation", exact: true }).click()
  await page.screenshot({ path: "/tmp/sdr-browser/home.png" })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth
    ),
    false
  )
  assert.deepEqual(errors, [])
  results.push(
    "1280x720: hydrated tabs, no horizontal overflow or browser errors"
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: "/tmp/sdr-browser/mobile.png", fullPage: true })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth
    ),
    false
  )
  results.push("390x844: no page horizontal overflow")
  const brief =
    "Find 2 prospects at design agencies. Spend up to $1 on research. Show me the first one email."
  const started = await context.request.post(`${base}/api/run`, {
    data: { brief },
  })
  assert.equal(started.status(), 200)
  const { run } = await started.json()
  assert.equal(run.budget, 1_000_000)
  assert.equal(run.target, 2)
  const other = await browser.newContext()
  const denied = await other.request.post(`${base}/api/chat`, {
    data: { runId: run.id, model: "invalid", messages: [] },
  })
  assert.equal(denied.status(), 404)
  const csrf = await context.request.post(`${base}/api/approve`, {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  })
  assert.equal(csrf.status(), 400)
  results.push(
    "API: budget parsed, cross-user run access rejected, cross-origin approval rejected"
  )
  let limited = false
  for (let i = 0; i < 16; i++) {
    const response = await context.request.post(`${base}/api/chat`, {
      data: { runId: run.id, model: "invalid-model-no-spend", messages: [] },
    })
    if (response.status() === 429) {
      limited = true
      break
    }
    assert.ok(
      [400, 503].includes(response.status()),
      `Unexpected chat response ${response.status()}: ${await response.text()}`
    )
  }
  assert.ok(limited, "expected durable rate limit")
  results.push(
    "API: repeated chat requests reach HTTP 429 without invoking a model"
  )
  await other.close()
  await context.close()

  // Fixture data is restricted to intercepted browser requests; no provider execution.
  const fixtureContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  })
  const fixturePage = await fixtureContext.newPage()
  const fixture = {
    ...run,
    id: "11111111-1111-4111-8111-111111111111",
    target: 20,
    budget: 25_000_000,
    status: "awaiting_review",
    companies: [
      {
        id: "co",
        name: "Example Agency",
        domain: "example.com",
        country: "US",
        employees: 25,
        industry: "Marketing",
        signal: "Hiring an account director",
        financeAssessment: "Fixture research",
        qualified: true,
        evidence: [
          {
            url: "https://example.com",
            quote: "Fixture evidence",
            callId: "call",
          },
        ],
      },
    ],
    prospects: [
      {
        id: "p",
        companyId: "co",
        person: "Alex Example",
        title: "Founder",
        email: "alex@example.com",
        evidence: [],
        verificationCallId: "call",
        screeningCallIds: [],
        checkedAt: new Date().toISOString(),
      },
    ],
    proposals: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        prospectId: "p",
        subject: "A bookkeeping consultation",
        body: "Hi Alex, would a 20-minute consultation about your bookkeeping be helpful?",
        status: "pending",
      },
    ],
    calls: [
      {
        id: "call",
        key: "call",
        slug: "EXA_SEARCH",
        provider: "exa",
        action: "Search the web",
        source: "Wallet",
        step: "Find companies",
        status: "succeeded",
        reserved: 100_000,
        charge: 12_500,
        at: new Date().toISOString(),
        args: {},
      },
    ],
    messages: [],
    connections: { gmail: { connected: true }, hubspot: { connected: true } },
    note: "Fixture: ready for review",
  }
  let submitted
  await fixturePage.route("**/api/run*", (route) =>
    route.fulfill({
      json: { run: fixture, setup: { composio: true, gateway: true } },
    })
  )
  await fixturePage.route("**/api/approve", (route) => {
    submitted = route.request().postDataJSON()
    fixture.proposals[0] = {
      ...fixture.proposals[0],
      ...submitted,
      status: "drafted",
      draftId: "fixture-draft",
    }
    return route.fulfill({ json: { ok: true, call: { status: "succeeded" } } })
  })
  await fixturePage.goto(base, { waitUntil: "networkidle" })
  await fixturePage.getByRole("button", { name: "Review emails (1)" }).click()
  await fixturePage
    .getByLabel("Subject for Alex Example")
    .fill("Edited subject from the human")
  await fixturePage
    .getByLabel("Email for Alex Example")
    .fill("This is the reviewed and edited email body from the human.")
  assert.equal(submitted, undefined)
  await fixturePage.screenshot({ path: "/tmp/sdr-browser/review.png" })
  await fixturePage
    .getByRole("button", { name: "Approve & create draft" })
    .click()
  await fixturePage
    .getByText("Saved to your Gmail drafts. Nothing sent.")
    .waitFor()
  assert.equal(submitted.subject, "Edited subject from the human")
  assert.equal(submitted.decision, "approve")
  await fixturePage.getByRole("button", { name: "Prospects 1/20" }).click()
  await fixturePage.getByText("Example Agency", { exact: true }).waitFor()
  await fixturePage.screenshot({ path: "/tmp/sdr-browser/results.png" })
  await fixturePage.getByRole("button", { name: "Tool calls (1)" }).click()
  await fixturePage.getByLabel("exa Search the web").waitFor()
  assert.equal(
    await fixturePage.locator(".spend-number").textContent(),
    "$0.0125"
  )
  results.push(
    "Fixture UI: edited approval requires click; results, Wallet card and spend agree"
  )
  await fixtureContext.close()
  await writeFile(
    "/tmp/sdr-browser/results.json",
    JSON.stringify(results, null, 2)
  )
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
